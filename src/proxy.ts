// src/proxy.ts
// /api/qsp/*, /api/musbi/*, /api/detect-roof, /api/image/* 보호 — Origin 검증 + per-IP sliding-window rate limit (in-memory).
// detect-roof 는 Gemini 과금이 큰 고비용 경로라 더 낮은 전용 한도를 적용한다.
// 단일 인스턴스 배포(docker-compose) 전제. 스케일아웃 시 분산 저장소로 교체 필요.
// Next.js 16 의 proxy 컨벤션: 함수명은 `proxy`, runtime 은 nodejs 고정.
import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: [
    "/api/qsp/:path*",
    "/api/musbi/:path*",
    "/api/detect-roof",
    "/api/image/:path*",
  ],
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 30;
// detect-roof 는 요청마다 Gemini Vision 을 최대 2회 호출하므로 과금 보호를 위해 강화.
const DETECT_RATE_LIMIT_MAX = 10;
const MAX_TRACKED_IPS = 10_000;

// 신뢰 가능한 앞단 리버스 프록시(LB/nginx) 수.
// X-Forwarded-For 는 클라이언트가 왼쪽에 임의 값을 채울 수 있고, 신뢰 프록시는 오른쪽에 실제 IP 를 덧붙인다.
// 따라서 오른쪽에서 이 hop 수만큼 들어온 항목만 신뢰한다(클라이언트 위조분은 무시).
// 프록시 없이 직접 노출하는 배포에서는 XFF 가 없어 IP 별 rate-limit 이 동작하지 않는다(운영은 프록시 뒤 배포 전제).
const TRUSTED_PROXY_HOPS = 1;

// 허용 Origin 목록 — standalone(리버스 프록시 뒤) 에서는 req.nextUrl.origin 이 컨테이너
// bind 주소(HOSTNAME:PORT, 예: 0.0.0.0:3000)라 브라우저 Origin 과 절대 일치하지 않는다.
// 따라서 신뢰할 공개 Origin 을 ALLOWED_ORIGIN(쉼표 구분) 으로 명시한다.
// 미설정 시 req.nextUrl.origin 으로 폴백 → 로컬 dev(localhost) 의 same-origin 요청은 그대로 통과.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const hits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const list = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // 오른쪽에서 TRUSTED_PROXY_HOPS 번째 = 신뢰 프록시가 관측한 실제 클라이언트 IP.
    const ip = list[list.length - TRUSTED_PROXY_HOPS];
    if (ip) return ip;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function checkRateLimit(
  key: string,
  max: number,
): {
  ok: boolean;
  resetMs: number;
} {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const arr = hits.get(key) ?? [];
  const pruned = arr.filter((t) => t > windowStart);

  if (pruned.length >= max) {
    const oldest = pruned[0] ?? now;
    return { ok: false, resetMs: oldest + RATE_LIMIT_WINDOW_MS - now };
  }

  pruned.push(now);
  // 키 재삽입으로 Map insertion order 갱신 → LRU 동작
  hits.delete(key);
  hits.set(key, pruned);

  if (hits.size > MAX_TRACKED_IPS) {
    const firstKey = hits.keys().next().value;
    if (firstKey !== undefined) hits.delete(firstKey);
  }

  return { ok: true, resetMs: RATE_LIMIT_WINDOW_MS };
}

// 경로별 rate-limit 버킷/한도 — detect-roof 는 고비용이라 별도 버킷에 강화 한도.
function rateLimitFor(pathname: string): { bucket: string; max: number } {
  if (pathname.startsWith("/api/detect-roof")) {
    return { bucket: "detect", max: DETECT_RATE_LIMIT_MAX };
  }
  return { bucket: "bff", max: DEFAULT_RATE_LIMIT_MAX };
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
  // CSRF 보호 — Origin 헤더가 있으면 허용 목록(ALLOWED_ORIGIN, 미설정 시 req.nextUrl.origin)과 일치해야 한다.
  // same-origin GET/HEAD 는 브라우저가 Origin 헤더를 붙이지 않으므로(safe method),
  // Origin 부재 시에는 GET/HEAD 만 통과시키고 그 외 메서드는 차단한다.
  const origin = req.headers.get("origin");
  const allowed =
    ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : [req.nextUrl.origin];
  const isSafeMethod = req.method === "GET" || req.method === "HEAD";
  const blocked = origin ? !allowed.includes(origin) : !isSafeMethod;
  if (blocked) {
    console.warn(
      `[proxy] 403 Forbidden origin — path=${req.nextUrl.pathname} method=${req.method} origin=${origin ?? "(none)"} allowed=${allowed.join("|")}`,
    );
    return envelopeError(403, 403, "Forbidden origin");
  }

  const { bucket, max } = rateLimitFor(req.nextUrl.pathname);
  const rl = checkRateLimit(`${bucket}:${clientIp(req)}`, max);
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
