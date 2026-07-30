---
type: Control
title: Security Perimeter
description: proxy.ts 가 모든 BFF 라우트 앞에서 Origin 검증(CSRF)과 per-IP sliding-window rate limit 을 수행한다.
resource: src/proxy.ts
tags: [security, csrf, rate-limit, proxy]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: proxy
    resource: src/proxy.ts
    title: proxy 함수 구현
  - id: security-review
    resource: docs/security-review-2026-06-02.md
    title: 멀티에이전트 보안 코드리뷰
    last_modified: 2026-06-02
---

# 적용 범위

Next.js 16 의 proxy 컨벤션(구 `middleware` 는 deprecated). 함수명은 `proxy`, matcher:

```
/api/qsp/:path*   /api/musbi/:path*   /api/detect-roof   /api/image/:path*
```

`/api/openapi` 와 `/reference` 는 이 경계 **밖**이다 — 대신 `ENABLE_API_DOCS` 로 노출 자체를 막는다.

# ① Origin 검증 (CSRF)

- `Origin` 헤더가 있으면 허용 목록과 정확히 일치해야 한다.
- 허용 목록 = `ALLOWED_ORIGIN`(쉼표 구분). **미설정 시 `req.nextUrl.origin` 으로 폴백**.
- `Origin` 헤더가 없으면 GET/HEAD 만 통과, 그 외 메서드는 차단. (브라우저는 safe method 에 Origin 을 붙이지 않는다)

⚠️ **배포에서 `ALLOWED_ORIGIN` 은 필수다.** standalone 빌드는 `HOSTNAME=0.0.0.0`, `PORT=3000` 으로 바인드하므로
`req.nextUrl.origin` 이 `http://0.0.0.0:3000` 같은 컨테이너 내부 주소가 된다. 리버스 프록시 뒤에서 브라우저가 보내는
Origin(`https://pvmap-dev.q-cells.jp`)과 절대 일치할 수 없어 **모든 POST 가 403** 이 된다.
로컬 dev 에서만 우연히 동작하는 폴백이다.

# ② per-IP rate limit

in-memory sliding window, 창 크기 60초.

| 버킷 | 대상 | 한도 |
|------|------|------|
| `bff` | qsp / musbi / image | 30 req/min |
| `detect` | detect-roof | 10 req/min |

detect-roof 만 낮은 이유: 호출 자체는 한 번이지만 thinking + output 토큰 과금이 BFF 대비 크다.

- 키는 `{bucket}:{clientIP}`. 초과 시 429 + `Retry-After`(초).
- `MAX_TRACKED_IPS = 10_000` 을 넘으면 Map insertion order 기반 LRU 로 가장 오래된 키를 버린다
  (`hits.delete(key)` 후 `set` 재삽입으로 순서를 갱신).

# clientIP 결정 규칙

`X-Forwarded-For` 를 **오른쪽에서** `TRUSTED_PROXY_HOPS`(=1) 번째 항목만 채택한다.
XFF 는 클라이언트가 왼쪽에 아무 값이나 채울 수 있고 신뢰 프록시는 오른쪽에 실제 IP 를 덧붙이기 때문 —
왼쪽을 읽으면 헤더 위조로 한도를 무한히 우회할 수 있다. 없으면 `X-Real-IP`, 그것도 없으면 `"unknown"`.

# 알려진 한계

- **단일 인스턴스 전제.** 카운터가 프로세스 메모리에 있어 스케일아웃하면 실효 한도가 인스턴스 수만큼 늘어난다.
  분산 저장소(Redis 등)로 교체해야 한다.
- **리버스 프록시 뒤 배포 전제.** XFF 를 붙여주는 앞단이 없으면 모든 요청이 `"unknown"` 한 키에 몰려
  IP 별 제한이 사실상 전역 제한이 된다.
- 애플리케이션 레벨 인증이 없다. 이 경계는 CSRF 와 과금 폭주를 막을 뿐, 인가를 대체하지 않는다.
