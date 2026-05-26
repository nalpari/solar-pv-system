// src/app/reference/route.ts
// Scalar 기반 API Reference UI. /api/openapi 에서 spec 을 로드한다.
// 운영 환경에서는 노출을 막기 위해 404 를 반환한다.
import { ApiReference } from "@scalar/nextjs-api-reference";

const scalarHandler = ApiReference({
  url: "/api/openapi",
  theme: "default",
  pageTitle: "Solar PV System API",
});

export function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not Found", { status: 404 });
  }
  return scalarHandler();
}
