// src/app/api/openapi/route.ts
// OpenAPI 3.1 스펙을 JSON 으로 제공. /reference UI 가 이 엔드포인트를 소비한다.
// ENABLE_API_DOCS=true 환경에서만 노출하고, 그 외에는 404 — 내부 API 명세 노출 차단.
// (NODE_ENV 가드는 dev/prod 모두 production 빌드를 쓰는 배포 모델과 충돌하므로 사용하지 않음)
import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/openapi";

export const runtime = "nodejs";

let cached: ReturnType<typeof buildOpenApiDocument> | null = null;
function getSpec() {
  if (!cached) cached = buildOpenApiDocument();
  return cached;
}

export function GET() {
  if (process.env.ENABLE_API_DOCS !== "true") {
    return new NextResponse("Not Found", { status: 404 });
  }
  return NextResponse.json(getSpec());
}
