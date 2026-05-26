// src/app/api/openapi/route.ts
// OpenAPI 3.1 스펙을 JSON 으로 제공. /reference UI 가 이 엔드포인트를 소비한다.
// 운영 환경에서는 내부 API 명세 노출을 막기 위해 404 를 반환한다.
import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/openapi";

export const runtime = "nodejs";

let cached: ReturnType<typeof buildOpenApiDocument> | null = null;
function getSpec() {
  if (!cached) cached = buildOpenApiDocument();
  return cached;
}

export function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }
  return NextResponse.json(getSpec());
}
