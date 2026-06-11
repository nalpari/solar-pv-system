import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서브패스 배포(리버스 프록시 /pvmap) — NEXT_PUBLIC_BASE_PATH 한 값으로 페이지·자산·API 경로 일괄 관리
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  output: "standalone",
  reactCompiler: true,
};

export default nextConfig;
