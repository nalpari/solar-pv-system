// src/app/api/image/upload/route.ts
// 참조 이미지 S3 업로드/삭제 라우트 (qcast-front /api/image/upload 패턴 이식).
// - 키는 `pvmap/{uuid}.{ext}` 로 생성해 파일명 충돌·덮어쓰기를 방지한다.
// - DELETE 는 UPLOAD_KEY_PATTERN 에 맞는 키만 허용해 다른 프리픽스 오브젝트 삭제를 차단한다.
// - Origin 검증 + rate limit 은 src/proxy.ts (/api/image/*) 에서 적용된다.
import { NextResponse, type NextRequest } from "next/server";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { envelopeError } from "@/lib/qsp/client";
import {
  ALLOWED_IMAGE_TYPES,
  UPLOAD_KEY_PATTERN,
  type AllowedImageType,
  type UploadImageResult,
} from "@/lib/image/schema";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const EXT_BY_TYPE: Record<AllowedImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/gif": "gif",
};

function isAllowedImageType(type: string): type is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}

const Bucket = process.env.AMPLIFY_BUCKET ?? "";
// 끝 슬래시 제거 — filePath 조립 시 이중 슬래시 방지.
const publicBaseUrl = (process.env.NEXT_PUBLIC_AWS_S3_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

let s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  s3Client ??= new S3Client({ region: process.env.AWS_REGION });
  return s3Client;
}

// 누락 env 는 서버 로그에만 상세를 남기고 클라이언트에는 일반 메시지로 응답한다.
function envError(route: string): NextResponse | null {
  const missing = [
    "AMPLIFY_BUCKET",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "NEXT_PUBLIC_AWS_S3_BASE_URL",
  ].filter((key) => !process.env[key]);
  if (missing.length === 0) return null;
  console.error(`[${route}] 환경변수 미설정: ${missing.join(", ")}`);
  return envelopeError(500, 500, "Server is missing S3 configuration");
}

export async function POST(req: NextRequest) {
  const configError = envError("image/upload");
  if (configError) return configError;

  let file: FormDataEntryValue | null;
  try {
    const formData = await req.formData();
    file = formData.get("file");
  } catch {
    return envelopeError(400, 400, "Failed to read multipart form data");
  }

  if (!(file instanceof File)) {
    return envelopeError(400, 400, "file field is required");
  }
  if (!isAllowedImageType(file.type)) {
    return envelopeError(
      400,
      400,
      `Unsupported image type — allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    );
  }
  if (file.size === 0) {
    return envelopeError(400, 400, "Empty file");
  }
  if (file.size > MAX_FILE_BYTES) {
    return envelopeError(413, 413, "File too large (max 10MB)");
  }

  const Key = `pvmap/${crypto.randomUUID()}.${EXT_BY_TYPE[file.type]}`;

  try {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket,
        Key,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: file.type,
      }),
    );
  } catch (err) {
    console.error("[image/upload] S3 업로드 실패:", err);
    return envelopeError(502, 502, "Failed to upload image");
  }

  const data: UploadImageResult = {
    filePath: `${publicBaseUrl}/${Key}`,
    fileName: Key,
  };
  return NextResponse.json({ success: true, data });
}

export async function DELETE(req: NextRequest) {
  const configError = envError("image/upload");
  if (configError) return configError;

  const fileName = req.nextUrl.searchParams.get("fileName");
  if (!fileName) {
    return envelopeError(400, 400, "fileName parameter is required");
  }
  if (!UPLOAD_KEY_PATTERN.test(fileName)) {
    return envelopeError(400, 400, "Invalid fileName format");
  }

  try {
    await getS3Client().send(
      new DeleteObjectCommand({ Bucket, Key: fileName }),
    );
  } catch (err) {
    console.error("[image/upload] S3 삭제 실패:", err);
    return envelopeError(502, 502, "Failed to delete image");
  }

  return NextResponse.json({ success: true, data: null });
}
