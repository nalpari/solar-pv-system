// src/app/api/openapi/route.ts
// OpenAPI 3.1 스펙을 JSON 으로 제공. /reference UI 가 이 엔드포인트를 소비한다.
import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/openapi";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(buildOpenApiDocument());
}
