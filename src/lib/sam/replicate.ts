// src/lib/sam/replicate.ts
// Replicate API 를 통해 SAM 2 모델로 입력 이미지의 건물 마스크를 추출한다.
// 실패는 호출자에서 graceful degradation 으로 처리하기 위해 null 반환.
//
// 호출 패턴 (공식/비공식 모델 모두 작동):
//   1. GET  /v1/models/{owner}/{name}      → latest_version.id 추출
//   2. POST /v1/predictions                → { version, input } 으로 예측 생성
//
// meta/sam-2 는 point prompt 를 지원하지 않고 자동 전체 세그먼트만 한다. 출력의
// combined_mask(모든 세그먼트 합집합)를 사용한다. individual_masks 로 중앙 건물만
// 골라내는 방식도 시도했으나, SAM 이 건물을 면·구조물 단위로 잘게 쪼개 건물 크기 마스크가
// 안 나와 실패 → combined_mask + 프롬프트(EXTERNAL_HINT)로 Gemini 가 노이즈를 거르게 한다.

const MODEL_OWNER = "meta";
const MODEL_NAME = "sam-2";
const MODEL_INFO_URL = `https://api.replicate.com/v1/models/${MODEL_OWNER}/${MODEL_NAME}`;
const PREDICTIONS_URL = "https://api.replicate.com/v1/predictions";

type ReplicateModelInfo = {
  latest_version?: { id: string };
};

type ReplicateResponse = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: { combined_mask?: string } | unknown;
  error?: string | null;
};

/**
 * Replicate Meta SAM 2 호출 → 입력 이미지의 건물 마스크 PNG dataURL 반환.
 *
 * - 토큰 미설정 / 호출 실패 / 출력 형식 불일치 시 null 반환 (graceful degradation).
 *   호출자는 null 받으면 Gemini 단독 호출로 폴백.
 * - 동기 호출 (Prefer: wait) — 최대 60초 대기.
 *
 * @param imageDataUrl 원본 이미지 (base64 data URL)
 * @returns 마스크 PNG dataURL 또는 null
 */
export async function fetchSamMask(imageDataUrl: string): Promise<string | null> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.warn("[sam-poc] REPLICATE_API_TOKEN 미설정 — SAM 단계 생략, Gemini 단독 진행");
    return null;
  }

  try {
    // Step 1: 모델의 latest_version id 조회 (공식/비공식 모델 모두 작동)
    const modelRes = await fetch(MODEL_INFO_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!modelRes.ok) {
      const body = await modelRes.text().catch(() => "<read-failed>");
      console.warn(
        `[sam-poc] 모델 조회 실패 HTTP ${modelRes.status} ${modelRes.statusText} url=${MODEL_INFO_URL} body=${body.slice(0, 1000)}`,
      );
      return null;
    }
    const modelInfo = (await modelRes.json()) as ReplicateModelInfo;
    const versionId = modelInfo.latest_version?.id;
    if (!versionId) {
      console.warn("[sam-poc] 모델 응답에 latest_version 없음", { modelInfo });
      return null;
    }

    // Step 2: prediction 생성 (Prefer: wait 로 동기 응답)
    const res = await fetch(PREDICTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        version: versionId,
        input: {
          image: imageDataUrl,
          // 자동 마스크 생성 모드 → combined_mask(모든 세그먼트 합집합) 사용.
          // 개별 마스크 선택은 SAM 이 건물을 면·구조물 단위로 잘게 쪼개 실패했으므로
          // combined_mask 를 그대로 쓰고, 마스크에 섞인 옆건물·그림자는 프롬프트로 Gemini 가 거른다.
          points_per_side: 16,
          pred_iou_thresh: 0.88,
          stability_score_thresh: 0.95,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "<read-failed>");
      console.warn(
        `[sam-poc] Replicate HTTP ${res.status} ${res.statusText} url=${PREDICTIONS_URL} version=${versionId} body=${body.slice(0, 1000)}`,
      );
      return null;
    }

    const data = (await res.json()) as ReplicateResponse;

    if (data.status !== "succeeded") {
      console.warn(
        `[sam-poc] Replicate status=${data.status}`,
        { error: data.error, fullResponse: JSON.stringify(data).slice(0, 1000) },
      );
      return null;
    }

    const output = data.output as { combined_mask?: string } | undefined;
    const combinedUrl =
      typeof output?.combined_mask === "string" && isHttpUrl(output.combined_mask)
        ? output.combined_mask
        : extractMaskUrl(data.output);

    if (!combinedUrl) {
      console.warn("[sam-poc] 마스크 URL 없음", {
        outputPreview: JSON.stringify(data.output).slice(0, 500),
      });
      return null;
    }

    // combined_mask 다운로드 → dataURL (Gemini 전달 + 클라이언트 디버그 시각화 공용)
    const imgRes = await fetch(combinedUrl);
    if (!imgRes.ok) {
      console.warn(`[sam-poc] combined_mask 다운로드 실패 HTTP ${imgRes.status}`);
      return null;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const mediaType = imgRes.headers.get("content-type") ?? "image/png";
    return `data:${mediaType};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.warn(
      "[sam-poc] SAM 호출 예외 — graceful degradation:",
      err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
    );
    return null;
  }
}

/**
 * Replicate Meta SAM 2 의 output 형식은 모델 버전에 따라 달라질 수 있어
 * 여러 형태를 시도한다 (URL 문자열 / URL 배열 / { combined_mask } / { individual_masks } ...).
 * 가장 먼저 인식 가능한 마스크 URL 하나를 반환.
 */
function extractMaskUrl(output: unknown): string | null {
  if (typeof output === "string" && isHttpUrl(output)) return output;

  if (Array.isArray(output)) {
    const first = output.find((v) => typeof v === "string" && isHttpUrl(v));
    if (typeof first === "string") return first;
  }

  if (output && typeof output === "object") {
    const obj = output as Record<string, unknown>;
    for (const key of ["combined_mask", "mask", "image", "output"]) {
      const v = obj[key];
      if (typeof v === "string" && isHttpUrl(v)) return v;
      if (Array.isArray(v)) {
        const first = v.find((x) => typeof x === "string" && isHttpUrl(x));
        if (typeof first === "string") return first;
      }
    }
    const masks = obj.individual_masks;
    if (Array.isArray(masks) && typeof masks[0] === "string" && isHttpUrl(masks[0])) {
      return masks[0];
    }
  }

  return null;
}

function isHttpUrl(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://");
}
