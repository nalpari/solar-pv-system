// src/proxy.ts
// /api/qsp/*, /api/musbi/* 보호 — Origin 검증 + per-IP sliding-window rate limit (in-memory).
// 단일 인스턴스 배포(docker-compose) 전제. 스케일아웃 시 분산 저장소로 교체 필요.
// Next.js 16 의 proxy 컨벤션: 함수명은 `proxy`, runtime 은 nodejs 고정.
import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/api/qsp/:path*", "/api/musbi/:path*"],
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
  // CSRF 보호 — Origin 헤더가 있으면 사이트 origin 과 일치해야 한다(cross-origin 차단).
  // same-origin GET/HEAD 는 브라우저가 Origin 헤더를 붙이지 않으므로(safe method),
  // Origin 부재 시에는 GET/HEAD 만 통과시키고 그 외 메서드는 차단한다.
  const origin = req.headers.get("origin");
  const expected = req.nextUrl.origin;
  const isSafeMethod = req.method === "GET" || req.method === "HEAD";
  const blocked = origin ? origin !== expected : !isSafeMethod;
  if (blocked) {
    console.warn(
      `[proxy] 403 Forbidden origin — path=${req.nextUrl.pathname} method=${req.method} origin=${origin ?? "(none)"} expected=${expected}`,
    );
    return envelopeError(403, 403, "Forbidden origin");
  }

  const rl = checkRateLimit(clientIp(req));
  if (!rl.ok) {
    console.warn(
      `[proxy] 429 Too many requests — path=${req.nextUrl.pathname} ip=${clientIp(req)}`,
    );
    const res = envelopeError(429, 429, "Too many requests");
    res.headers.set("Retry-After", String(Math.ceil(rl.resetMs / 1000)));
    return res;
  }

  return NextResponse.next();
}
