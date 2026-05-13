import type { CropData, PixelPolygon } from "../types";

/**
 * `/api/detect-roof` 응답 타입 (solar-precision의 schema.ts와 동일)
 * azimuth/tilt/confidence/label은 받지만 사용 안 함 (D4: 완전 무시)
 */
export interface DetectApiResponse {
  polygons: Array<{
    points: [number, number][]; // 정규화 [0..1]
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
 * @throws 네트워크 실패 또는 API 에러 응답 시 (D6: 호출자가 메시지만 표시)
 */
export async function detectRoofs(
  cropData: CropData,
): Promise<DetectApiResponse> {
  const res = await fetch("/api/detect-roof", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageDataUrl: cropData.imageDataUrl,
      bounds: cropData.bounds,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `API 호출 실패 (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Gemini가 반환한 정규화 [0..1] 폴리곤을 캔버스 픽셀 좌표로 변환
 *
 * 입력 좌표계: 서버가 분석한 원본 이미지의 [0..1]
 * 출력 좌표계: CropPopup 캔버스의 픽셀 (캔버스 크기 = 원본 이미지 크기)
 *
 * 모든 결과는 `type: "install"` 로 매핑 (D3: AI 결과는 설치 영역)
 * `id`는 호출자에서 부여 (pv-system의 기존 폴리곤 생성 패턴과 일관성)
 *
 * @param response /api/detect-roof 응답
 * @param canvasW  원본 이미지의 픽셀 너비 (imageDataUrl의 naturalWidth)
 * @param canvasH  원본 이미지의 픽셀 높이
 */
export function normalizedToPixelPolygons(
  response: DetectApiResponse,
  canvasW: number,
  canvasH: number,
): Omit<PixelPolygon, "id">[] {
  return response.polygons.map((p) => ({
    type: "install" as const,
    points: p.points.map(([x, y]) => ({
      x: x * canvasW,
      y: y * canvasH,
    })),
  }));
}
