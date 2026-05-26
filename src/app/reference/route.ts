// src/app/reference/route.ts
// Scalar 기반 API Reference UI. /api/openapi 에서 spec 을 로드한다.
// ENABLE_API_DOCS=true 환경에서만 노출하고, 그 외에는 404.
import { ApiReference } from "@scalar/nextjs-api-reference";

const scalarHandler = ApiReference({
  url: "/api/openapi",
  theme: "default",
  pageTitle: "Solar PV System API",
});

export function GET() {
  if (process.env.ENABLE_API_DOCS !== "true") {
    return new Response("Not Found", { status: 404 });
  }
  return scalarHandler();
}
