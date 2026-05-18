import type { CropData, PixelPolygon } from "../types";

/**
 * 정규화 [0..1] 좌표 폴리곤
 * - Gemini가 반환하는 좌표계 (서버가 분석한 이미지 기준)
 * - 변환은 CropPopup에서 캔버스 크기 알 때 수행 (R2 회피)
 */
export type NormalizedPolygon = [number, number][];

/**
 * `/api/detect-roof` 응답 타입 (solar-precision의 schema.ts와 동일)
 * azimuth/tilt/confidence/label은 받지만 사용 안 함 (D4: 완전 무시)
 */
export interface DetectApiResponse {
  polygons: Array<{
    points: NormalizedPolygon;
    label: string;
    confidence: number;
    azimuth: number;
    tilt: number;
  }>;
  reason?: "ok" | "low_confidence" | "no_polygons";
  bboxConfidence?: number;
}

/**
 * Gemini API에 크롭 이미지를 보내 지붕면 폴리곤 자동 감지
 *
 * 응답의 azimuth/tilt/confidence/label은 D4 결정에 따라 버리고
 * points와 reason만 의미를 가짐
 *
 * @param signal AbortSignal — cropData 교체 시 진행 중 fetch 취소(F-1)
 * @throws 네트워크 실패 또는 API 에러 응답 시 (D6: 호출자가 메시지만 표시)
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
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `API 호출 실패 (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * 정규화 [0..1] 폴리곤을 캔버스 픽셀 좌표로 변환
 *
 * 출력 좌표계: CropPopup 캔버스의 픽셀 (canvas.width/height 기준)
 * 모든 결과는 `type: "install"` 로 매핑 (D3: AI 결과는 설치 영역)
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
  return polygons.map((points) => ({
    type: "install" as const,
    points: points.map(([x, y]) => ({
      x: x * canvasW,
      y: y * canvasH,
    })),
  }));
}
