---
type: API Endpoint
title: POST /api/detect-roof
description: 크롭 이미지를 받아 정규화 [0..1] 좌표의 지붕면 폴리곤 배열을 반환한다. 유일하게 성공 응답이 envelope 밖에 있다.
resource: src/app/api/detect-roof/route.ts
tags: [api, ai, gemini]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
stale_after: 2026-10-27
sources:
  - id: route
    resource: src/app/api/detect-roof/route.ts
    title: 라우트 구현
  - id: schema
    resource: src/lib/detect/schema.ts
    title: DetectResponseSchema (SSOT)
  - id: migration-plan
    resource: docs/plans/2026-07-27-gemini-to-openrouter-migration.md
    title: OpenRouter 전환 계획
    last_modified: 2026-07-27
---

> ⚠️ **stale_after 2026-10-27** — OpenRouter 전환이 착수되면 내부 구현이 바뀐다.
> 단, 이 문서가 기술하는 **요청/응답 계약은 전환 후에도 유지**되는 것이 계획의 전제다(D5: zod 가 최종 SSOT).

# 요청

```http
POST /api/detect-roof
Content-Type: application/json

{ "imageDataUrl": "data:image/png;base64,...", "bounds": { "sw": {...}, "ne": {...} } }
```

| 필드 | 필수 | 비고 |
|------|------|------|
| `imageDataUrl` | ✅ | `data:image/(png\|jpeg\|webp);base64,` 형식만 허용 |
| `bounds` | 보냄 | 클라이언트가 항상 보내지만 **서버는 현재 사용하지 않는다** |

크기 상한은 원본 5MB 를 base64(4/3배)로 환산한 값 + 256 바이트.
`Content-Length` 가 아니라 `arrayBuffer().byteLength` 로 실측한다 — 헤더는 위조·누락될 수 있다.

# 성공 응답 (200)

**envelope 로 감싸지 않는다.** 이 엔드포인트만의 예외다.

```json
{
  "polygons": [{ "points": [[0.12, 0.34], ...], "confidence": 0.87 }],
  "reason": "ok"
}
```

| 필드 | 설명 |
|------|------|
| `points` | 3~64개, 각 좌표 `[x, y]` ∈ [0,1]. 이미지 좌상단 기준 정규화 |
| `confidence` | 모델 자가평가. **서버 게이트 전용, 클라이언트는 읽지 않는다** |
| `reason` | `"ok"` \| `"no_polygons"` \| `"low_confidence"` — 진단용 |

`polygons: []` 는 오류가 아니라 정상 응답이다. `reason` 으로 이유를 구분한다.
어느 폴리곤이라도 신뢰도 0.5 미만이면 **전체가** 빈 배열이 된다
([`modules/ai-roof-detection.md`](/modules/ai-roof-detection.md) 참조).

# 오류 응답

`{ "success": false, "error": { "code": <n>, "message": "<한국어>" } }`

| status | 조건 |
|--------|------|
| 400 | 본문 읽기 실패 / 빈 본문 / 잘못된 JSON / `imageDataUrl` 누락·형식 오류 |
| 413 | 본문 초과 |
| 429 | 업스트림 rate limit **또는** [프록시 rate limit](/system/security-perimeter.md) (10 req/min) |
| 500 | `GEMINI_API_KEY` 또는 `GEMINI_MODEL` 미설정 |
| 502 | 그 외 업스트림 오류 전부 (401·403 포함해 클램프) |
| 403 | Origin 불일치 (프록시 단계) |

**429 만 passthrough, 나머지 업스트림 오류는 502 로 클램프**한다. 메시지는 한국어 3종으로 치환되며
모델명·티어·키 출처 같은 provider 힌트는 서버 로그에만 남는다.

# 지연

SAM(최대 60초 대기) + Gemini(thinking 4096 + output) 직렬이라 **수 초~수십 초**가 정상 범위다.
클라이언트에 타임아웃이 없고 `AbortController` 로 사용자 취소만 지원한다.
진단은 `docs/investigations/2026-06-04-detect-roof-latency-analysis.md`.
