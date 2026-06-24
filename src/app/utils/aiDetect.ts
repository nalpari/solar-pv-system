import type { CropData, PixelPolygon } from "../types";

/**
 * 정규화 [0..1] 좌표 폴리곤
 * - Gemini가 반환하는 좌표계 (서버가 분석한 이미지 기준)
 * - 변환은 CropPopup에서 캔버스 크기 알 때 수행 (R2 회피)
 */
export type NormalizedPolygon = [number, number][];

/**
 * `/api/detect-roof` 응답 타입 (solar-precision의 schema.ts와 동일)
 */
export interface DetectApiResponse {
  polygons: Array<{
    points: NormalizedPolygon;
  }>;
  reason?: "ok" | "no_polygons";
}

/**
 * `/api/detect-roof` 에러 응답 (envelopeError 포맷).
 * - status: HTTP status code (429 / 502 / 504 등으로 클라이언트 분기 가능)
 * - code: 서버 envelope 의 error.code (현재는 status 와 동일)
 * 기존 호출자는 Error.message 만 사용하므로 호환 유지된다.
 */
export class DetectApiError extends Error {
  readonly status: number;
  readonly code: number | undefined;
  constructor(status: number, message: string, code?: number) {
    super(message);
    this.name = "DetectApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Gemini API에 크롭 이미지를 보내 지붕면 폴리곤 자동 감지
 *
 * @param signal AbortSignal — cropData 교체 시 진행 중 fetch 취소(F-1)
 * @throws DetectApiError — API 가 envelope 에러를 반환한 경우 (status + code 보존)
 * @throws Error — 네트워크 실패 등 그 외
 *         AbortError는 호출자가 무시해야 함 (의도된 취소)
 */
export async function detectRoofs(
  cropData: CropData,
  signal?: AbortSignal,
): Promise<DetectApiResponse> {
  const res = await fetch("/api/detect-roof", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageDataUrl: cropData.imageDataUrl,
      bounds: cropData.bounds,
    }),
    signal,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number };
    };
    throw new DetectApiError(
      res.status,
      err.error?.message ?? `API 호출 실패 (HTTP ${res.status})`,
      err.error?.code,
    );
  }

  return res.json();
}

/** 가장 긴 변의 인덱스를 반환 (i → i+1 기준). CropPopup의 동일 함수와 같은 로직 */
function findLongestEdgeIndex(points: { x: number; y: number }[]): number {
  let maxLen = 0;
  let idx = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    const len = Math.hypot(dx, dy);
    if (len > maxLen) {
      maxLen = len;
      idx = i;
    }
  }
  return idx;
}

/**
 * 정규화 [0..1] 폴리곤을 캔버스 픽셀 좌표로 변환
 *
 * 출력 좌표계: CropPopup 캔버스의 픽셀 (canvas.width/height 기준)
 * 모든 결과는 `type: "install"` 로 매핑 (D3: AI 결과는 설치 영역)
 * `eaveEdgeIndex`는 가장 긴 변으로 자동 부여 — 사용자 수동 그리기와 동일 패턴
 * (Boston B1: AI 직후 패널 배치 가능해야 한다는 UX 약속 충족)
 * `id`는 호출자에서 부여 (pv-system의 기존 폴리곤 생성 패턴과 일관성)
 *
 * @param polygons 정규화 [0..1] 폴리곤 배열
 * @param canvasW  캔버스 렌더 너비 (canvas.width)
 * @param canvasH  캔버스 렌더 높이 (canvas.height)
 */
export function normalizedToPixelPolygons(
  polygons: NormalizedPolygon[],
  canvasW: number,
  canvasH: number,
): Omit<PixelPolygon, "id">[] {
  return polygons.map((points) => {
    const pixelPoints = points.map(([x, y]) => ({
      x: x * canvasW,
      y: y * canvasH,
    }));
    return {
      type: "install" as const,
      points: pixelPoints,
      eaveEdgeIndex: findLongestEdgeIndex(pixelPoints),
    };
  });
}
