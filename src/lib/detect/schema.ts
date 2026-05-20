// src/lib/detect/schema.ts
import { z } from "zod";

const NormalizedPoint = z
  .tuple([z.number().finite().min(0).max(1), z.number().finite().min(0).max(1)]);

export const PolygonSchema = z.object({
  points: z.array(NormalizedPoint).min(3).max(64),
  /**
   * Slug-only label (Boston #4 Prompt Injection 차단).
   * 위성 이미지 안 텍스트가 LLM에 OCR로 흘러들어가 임의 문자열이 label로 반환되는 케이스 차단.
   * 영문/숫자/언더스코어만 40자 이내 — 도메인 어휘로 충분.
   */
  label: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/i),
  confidence: z.number().finite().min(0).max(1),
  /** Compass bearing of the down-slope direction. 0=N, 90=E, 180=S, 270=W. Use 0 for flat roofs. */
  azimuth: z.number().finite().min(0).max(360),
  /** Pitch in degrees from horizontal. 0 for flat roof. */
  tilt: z.number().finite().min(0).max(90),
});

export const DetectResponseSchema = z.object({
  polygons: z.array(PolygonSchema).min(0),
  /** Why the result came back this way — surfaced in client console for diagnosis. */
  reason: z
    .enum(["ok", "low_confidence", "no_polygons"])
    .optional(),
  /** First-stage bbox confidence (0–1) when known. */
  bboxConfidence: z.number().finite().min(0).max(1).optional(),
});

export const BboxResponseSchema = z.object({
  bbox: z.tuple([
    z.number().finite().min(0).max(1),
    z.number().finite().min(0).max(1),
    z.number().finite().min(0).max(1),
    z.number().finite().min(0).max(1),
  ]),
  confidence: z.number().finite().min(0).max(1),
});

export type DetectPolygon = z.infer<typeof PolygonSchema>;
export type DetectResponse = z.infer<typeof DetectResponseSchema>;
export type BboxResponse = z.infer<typeof BboxResponseSchema>;

export type LatLngBounds = {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
};

export type DetectRequestBody = {
  imageDataUrl: string;
  bounds: LatLngBounds;
};
