// src/app/reference/route.ts
// Scalar 기반 API Reference UI. /api/openapi 에서 spec 을 로드한다.
import { ApiReference } from "@scalar/nextjs-api-reference";

export const GET = ApiReference({
  url: "/api/openapi",
  theme: "default",
  pageTitle: "Solar PV System API",
});
