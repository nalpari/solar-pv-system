// src/proxy.ts
// /api/qsp/* 보호 — Origin 검증 + per-IP sliding-window rate limit (in-memory).
// 단일 인스턴스 배포(docker-compose) 전제. 스케일아웃 시 분산 저장소로 교체 필요.
// Next.js 16 의 proxy 컨벤션: 함수명은 `proxy`, runtime 은 nodejs 고정.
import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/api/qsp/:path*"],
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const MAX_TRACKED_IPS = 10_000;

const hits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function checkRateLimit(ip: string): {
  ok: boolean;
  resetMs: number;
} {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const arr = hits.get(ip) ?? [];
  const pruned = arr.filter((t) => t > windowStart);

  if (pruned.length >= RATE_LIMIT_MAX) {
    const oldest = pruned[0] ?? now;
    return { ok: false, resetMs: oldest + RATE_LIMIT_WINDOW_MS - now };
  }

  pruned.push(now);
  // 키 재삽입으로 Map insertion order 갱신 → LRU 동작
  hits.delete(ip);
  hits.set(ip, pruned);

  if (hits.size > MAX_TRACKED_IPS) {
    const firstKey = hits.keys().next().value;
    if (firstKey !== undefined) hits.delete(firstKey);
  }

  return { ok: true, resetMs: RATE_LIMIT_WINDOW_MS };
}

function envelopeError(
  status: number,
  code: number,
  message: string,
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}

export function proxy(req: NextRequest) {
  // CSRF 보호 — Origin 헤더가 없거나 사이트 origin과 다르면 차단
  const origin = req.headers.get("origin");
  const expected = req.nextUrl.origin;
  if (!origin || origin !== expected) {
    return envelopeError(403, 403, "Forbidden origin");
  }

  const rl = checkRateLimit(clientIp(req));
  if (!rl.ok) {
    const res = envelopeError(429, 429, "Too many requests");
    res.headers.set("Retry-After", String(Math.ceil(rl.resetMs / 1000)));
    return res;
  }

  return NextResponse.next();
}
