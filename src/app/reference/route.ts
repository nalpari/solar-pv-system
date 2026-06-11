// src/app/reference/route.ts
// Scalar 기반 API Reference UI. /api/openapi 에서 spec 을 로드한다.
// ENABLE_API_DOCS=true 환경에서만 노출하고, 그 외에는 404.
import { ApiReference } from "@scalar/nextjs-api-reference";

const scalarHandler = ApiReference({
  // Scalar 가 브라우저에서 fetch 하므로 basePath 를 수동 prefix (서브패스 배포 /pvmap 대응)
  url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/openapi`,
  theme: "default",
  pageTitle: "Solar PV System API",
});

export function GET() {
  if (process.env.ENABLE_API_DOCS !== "true") {
    return new Response("Not Found", { status: 404 });
  }
  return scalarHandler();
}
