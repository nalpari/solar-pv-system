// src/lib/sam/transformers.ts
// [SAM PoC self-host] @huggingface/transformers (v3) 를 통해 Node.js 안에서 직접
// SAM ViT-B (Xenova/sam-vit-base, ONNX 변환본) 추론을 수행한다.
//
// - 모델 가중치는 첫 호출 시 자동 다운로드 (~358MB) → ~/.cache/huggingface 캐싱
// - center point prompt 1개로 사용자 crop 중심의 객체 마스크 1개 추출
// - 실패 경로는 모두 null 반환 (호출자에서 graceful degradation)
//
// 첫 호출 시 1~2분, 이후 호출 ~10~20초 (CPU). Linux x86_64 / arm64 모두 지원.

import { PNG } from "pngjs";

type SamModule = typeof import("@huggingface/transformers");

type ModelHandles = { model: unknown; processor: unknown };

let cachedModulePromise: Promise<SamModule> | null = null;
let cachedModelPromise: Promise<ModelHandles> | null = null;

const MODEL_ID = "Xenova/sam-vit-base";

async function loadModule(): Promise<SamModule> {
  if (!cachedModulePromise) {
    cachedModulePromise = import("@huggingface/transformers");
  }
  return cachedModulePromise;
}

async function loadModel(): Promise<ModelHandles> {
  if (!cachedModelPromise) {
    cachedModelPromise = (async () => {
      const { SamModel, AutoProcessor } = await loadModule();
      console.info(`[sam-poc] 모델 로드 시작 (${MODEL_ID}) — 첫 호출 시 ~358MB 다운로드`);
      const startedAt = Date.now();
      const model = await SamModel.from_pretrained(MODEL_ID);
      const processor = await AutoProcessor.from_pretrained(MODEL_ID);
      console.info(`[sam-poc] 모델 로드 완료 (${Date.now() - startedAt}ms)`);
      return { model, processor };
    })();
  }
  return cachedModelPromise;
}

/**
 * Self-host SAM 추론으로 입력 이미지의 건물 마스크 dataURL 반환.
 * - 사용자 crop이 이미 건물 중심에 있다는 가정으로 center point prompt 사용
 * - 마스크는 ViT-B의 best score 1개 선택
 * - 실패 시 null → 호출자는 Gemini 단독 폴백
 */
export async function runSamLocal(imageDataUrl: string): Promise<string | null> {
  try {
    const { RawImage } = await loadModule();
    const { model, processor } = await loadModel();

    // base64 dataURL → Buffer → Blob → RawImage.fromBlob
    // (RawImage.read 는 URL/파일경로만 지원하고 dataURL 은 거부함)
    const match = /^data:(image\/\w+);base64,(.+)$/.exec(imageDataUrl);
    if (!match) {
      console.warn("[sam-poc] dataURL 형식 불일치 — 추론 생략");
      return null;
    }
    const [, mimeType, base64Data] = match;
    const buffer = Buffer.from(base64Data, "base64");
    const blob = new Blob([buffer], { type: mimeType });
    const image = await RawImage.fromBlob(blob);
    const w = image.width;
    const h = image.height;

    // center point prompt — label 1 = foreground (SAM 기본값)
    const inputPoints = [[[w / 2, h / 2]]];

    // ⚠️ processor / model 의 메서드는 변수로 *분리해서* 호출하면 `this` 가 손실되어
    // 내부에서 `this.image_processor` 등 접근 시 TypeError 발생. 항상 객체 통해 직접 호출.
    type ProcessorObj = {
      (image: unknown, options: { input_points: number[][][] }): Promise<Record<string, unknown>>;
      post_process_masks: (
        pred_masks: unknown,
        original_sizes: unknown,
        reshaped_input_sizes: unknown,
      ) => Promise<unknown[]>;
    };
    type ModelObj = (inputs: Record<string, unknown>) => Promise<{
      iou_scores: unknown;
      pred_masks: unknown;
    }>;

    const proc = processor as unknown as ProcessorObj;
    const mdl = model as unknown as ModelObj;

    const inputs = await proc(image, { input_points: inputPoints });
    const outputs = await mdl({ ...inputs });
    const masks = await proc.post_process_masks(
      outputs.pred_masks,
      inputs.original_sizes,
      inputs.reshaped_input_sizes,
    );

    // best mask 선택 — iou_scores 최대 인덱스
    const scoresTensor = outputs.iou_scores as { tolist: () => number[][][] };
    const scoresArr = scoresTensor.tolist()[0][0]; // shape (3,)
    const bestIdx = scoresArr.indexOf(Math.max(...scoresArr));

    // masks[0] 은 첫 이미지의 마스크들 Tensor (1, 3, H, W) 또는 (3, H, W)
    const maskTensor = masks[0] as { tolist: () => unknown };
    const maskList = maskTensor.tolist() as unknown;
    const bestMask = extractBestMask(maskList, bestIdx);
    if (!bestMask) {
      console.warn("[sam-poc] 마스크 추출 실패 — shape 불일치");
      return null;
    }

    const dataUrl = maskToDataUrl(bestMask, w, h);
    console.info(
      `[sam-poc] 추론 완료 best_score=${scoresArr[bestIdx].toFixed(3)} mask=${w}x${h}`,
    );
    return dataUrl;
  } catch (err) {
    console.warn(
      "[sam-poc] SAM 추론 예외 — graceful degradation:",
      err instanceof Error ? { name: err.name, message: err.message } : err,
    );
    return null;
  }
}

/**
 * SAM 모델의 마스크 tolist 결과가 (3, H, W) 또는 (1, 3, H, W) 형태로 올 수 있어
 * 둘 다 대응해 best 인덱스의 2D boolean 배열 반환.
 */
function extractBestMask(maskList: unknown, bestIdx: number): boolean[][] | null {
  if (!Array.isArray(maskList)) return null;
  // (1, 3, H, W)
  if (Array.isArray(maskList[0]) && Array.isArray((maskList[0] as unknown[])[0])) {
    const inner = maskList[0] as unknown[];
    if (inner.length > bestIdx && Array.isArray(inner[bestIdx])) {
      return inner[bestIdx] as boolean[][];
    }
  }
  // (3, H, W)
  if (maskList.length > bestIdx && Array.isArray(maskList[bestIdx])) {
    return maskList[bestIdx] as boolean[][];
  }
  return null;
}

/**
 * 2D boolean 마스크를 흑백 PNG dataURL 로 변환.
 * 마스크 영역: 흰색(255) + 알파 180 (CropPopup 에서 globalAlpha 0.35 와 합쳐 자연스럽게 반투명)
 * 배경: 알파 0 (투명)
 */
function maskToDataUrl(mask: boolean[][], width: number, height: number): string {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    const row = mask[y];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) << 2;
      const on = row?.[x] ? true : false;
      png.data[idx] = on ? 255 : 0;
      png.data[idx + 1] = on ? 255 : 0;
      png.data[idx + 2] = on ? 255 : 0;
      png.data[idx + 3] = on ? 180 : 0;
    }
  }
  const buffer = PNG.sync.write(png);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
