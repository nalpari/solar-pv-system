// src/lib/detect/schema.ts
import { z } from "zod";

const NormalizedPoint = z
  .tuple([z.number().finite().min(0).max(1), z.number().finite().min(0).max(1)]);

export const PolygonSchema = z.object({
  points: z.array(NormalizedPoint).min(3).max(64),
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
