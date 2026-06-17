// src/lib/image/schema.ts
// /api/image/upload 응답 zod 스키마 — OpenAPI 문서(src/lib/openapi.ts)의 SSOT.
import { z } from "zod";

// 업로드 허용 MIME 타입 (qcast-front 허용 목록 + webp)
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp",
  "image/gif",
] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const UploadImageResultSchema = z.object({
  filePath: z.string().meta({
    description: "업로드된 이미지의 공개 URL (NEXT_PUBLIC_AWS_S3_BASE_URL 기준)",
    example: "https://bucket.s3.ap-northeast-1.amazonaws.com/pvmap/3fa85f64-5717-4562-b3fc-2c963f66afa6.png",
  }),
  fileName: z.string().meta({
    description: "S3 오브젝트 키 (pvmap/{uuid}.{ext}) — 결과조회 redirect 의 roofImgSrc 로 전달",
    example: "pvmap/3fa85f64-5717-4562-b3fc-2c963f66afa6.png",
  }),
});
export type UploadImageResult = z.infer<typeof UploadImageResultSchema>;
