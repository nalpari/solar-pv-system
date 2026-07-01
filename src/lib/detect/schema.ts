// src/lib/detect/schema.ts
import { z } from "zod";

const NormalizedPoint = z
  .tuple([z.number().finite().min(0).max(1), z.number().finite().min(0).max(1)]);

export const PolygonSchema = z.object({
  points: z.array(NormalizedPoint).min(3).max(64),
  /**
   * 모델 자가평가 신뢰도 (0~1). 서버에서 임계값(현재 0.5) 미만 폴리곤을 환각으로 판정해
   * 빈 결과(reason="low_confidence")로 차단. 클라이언트는 읽지 않음 (D4 정책 유지).
   */
  confidence: z.number().finite().min(0).max(1),
});

export const DetectResponseSchema = z.object({
  polygons: z.array(PolygonSchema).min(0),
  /** Why the result came back this way — surfaced in client console for diagnosis. */
  reason: z
    .enum(["ok", "no_polygons", "low_confidence"])
    .optional(),
  /**
   * [SAM PoC 디버그] Replicate Meta SAM 2 가 추출한 건물 마스크의 base64 data URL.
   * 클라이언트에서 CropPopup 캔버스에 반투명 보라색 오버레이로 표시하여 SAM 외곽 정확도를 시각 평가.
   * SAM 호출 실패 / 토큰 미설정 시 undefined.
   */
  samMaskDataUrl: z.string().optional(),
});

export type DetectPolygon = z.infer<typeof PolygonSchema>;
export type DetectResponse = z.infer<typeof DetectResponseSchema>;

export type LatLngBounds = {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
};

export type DetectRequestBody = {
  imageDataUrl: string;
  bounds: LatLngBounds;
};
