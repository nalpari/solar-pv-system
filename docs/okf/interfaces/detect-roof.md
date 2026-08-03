---
type: API Endpoint
title: POST /api/detect-roof
description: 크롭 이미지를 받아 정규화 [0..1] 좌표의 지붕면 폴리곤 배열을 반환한다. 유일하게 성공 응답이 envelope 밖에 있다.
resource: src/app/api/detect-roof/route.ts
tags: [api, ai, openrouter]
generated: { by: claude-code/opus-5, at: 2026-07-30T06:37:15Z }
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
    last_modified: 2026-07-30
---

> ⚠️ **stale_after 2026-10-27** — 업스트림이 Gemini 직접 호출 → **OpenRouter Chat Completions** 로 교체됐다(2026-07-30).
> 계획의 전제대로 **요청/응답 계약은 전환 전과 동일**하다(D5: zod 가 최종 SSOT) — 바뀐 것은 업스트림 계약과 500/502 의 원인 집합뿐이다.
> 날짜를 유지하는 이유: 계획 §8 1단계 검증(canary·골든셋 A/B)과 §9 미검증 항목 10건이 아직 열려 있고,
> 모델 교체(2단계)가 `OPENROUTER_MODEL` 변경만으로 일어날 수 있어 이 문서의 모델 관련 서술이 조용히 낡을 수 있다.

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
| 500 | `OPENROUTER_API_KEY` 또는 `OPENROUTER_MODEL` 미설정 |
| 502 | 그 외 업스트림 오류 전부 (401·**402**·403 포함해 클램프) |
| 403 | Origin 불일치 (프록시 단계) |

**429 만 passthrough, 나머지 업스트림 오류는 502 로 클램프**한다. 메시지는 한국어 3종으로 치환되며
모델명·티어·키 출처 같은 provider 힌트는 서버 로그에만 남는다. 이 규약은 OpenRouter 전환 후에도 무변경이다.

## 업스트림 계약 (OpenRouter)

`POST https://openrouter.ai/api/v1/chat/completions` — Chat Completions. 전용 SDK 없이 `fetch` 로 호출한다.
구조화 출력은 `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }` 를 1차 계약으로 요구하지만 (`strict` 는 `json_schema` 안에 둔다 — `response_format` 바로 아래에 두면 400)
**최종 SSOT 는 zod** 다 — 프로바이더가 strict 를 hint 로만 처리해도 응답 형태 보증은 깨지지 않는다.

| 업스트림 status | 클라이언트 | 비고 |
|---|---|---|
| 429 | **429** | 유일한 passthrough |
| 401 / 403 | 502 | 키 무효 · 권한/moderation → "서비스 설정 오류" |
| **402** | 502 | **전환으로 생긴 장애 모드** — 계정 크레딧 소진. 관리자 조치가 필요하다는 점에서 401/403 클래스로 취급한다 |
| 400 / 404 / 408 / 413 / 5xx | 502 | 요청·라우팅·업스트림 오류 |
| 200 + `choices[0].error` | 502 | 생성 중 오류가 200 에 실려 오는 경로. 결과는 "텍스트 응답 없음"과 동일 |
| `finish_reason: "length"` / 빈 content | 502 | 토큰 예산 소진 |

402 는 **가용성이 과금 상태에 묶인다**는 뜻이다 — 코드로 방어할 수 없고 크레딧 잔액 운영 점검에 의존한다.

# 지연

SAM(최대 60초 대기) + 추론 1회(reasoning + output) 직렬이라 **수 초~수십 초**가 정상 범위다.
클라이언트에 타임아웃이 없고 `AbortController` 로 사용자 취소만 지원하지만,
서버 → OpenRouter 구간에는 180초 `AbortController` 타임아웃이 있다(SDK 를 버리며 잃은 안전장치를 명시적으로 복구).
wall-clock(`elapsedMs`)이 서버 로그에 남는다.
진단은 `docs/investigations/2026-06-04-detect-roof-latency-analysis.md` — **문서 맨 앞 정정 블록을 먼저 읽어야 한다.**
