---
type: Module
title: AI Roof Detection
description: 크롭 이미지에서 지붕면 폴리곤을 자동 감지한다. SAM 2 마스크(선택) + OpenRouter 비전 추론 + 신뢰도 게이트 3단 구성.
resource: src/app/api/detect-roof/route.ts
tags: [module, ai, openrouter, sam, vision]
generated: { by: claude-code/opus-5, at: 2026-07-30T06:55:44Z }
status: stable
stale_after: 2026-10-27
sources:
  - id: route
    resource: src/app/api/detect-roof/route.ts
    title: 감지 라우트 구현
  - id: sam
    resource: src/lib/sam/replicate.ts
    title: Replicate SAM 2 호출
  - id: client
    resource: src/app/utils/aiDetect.ts
    title: 클라이언트 fetch 래퍼 + 좌표 어댑터
  - id: migration-plan
    resource: docs/plans/2026-07-27-gemini-to-openrouter-migration.md
    title: OpenRouter 전환 계획 (설계 근거·미검증 항목)
    last_modified: 2026-07-30
  - id: latency
    resource: docs/investigations/2026-06-04-detect-roof-latency-analysis.md
    title: 지연 진단 (2026-07-30 정정 블록 있음)
    last_modified: 2026-07-30
---

> ⚠️ **stale_after 2026-10-27** — 2026-07-30 에 추론 호출 계층이 `@google/genai` 직접 호출 →
> **OpenRouter Chat Completions(`fetch`)** 로 교체됐다. 프롬프트·SAM·후처리(신뢰도 게이트)·클라이언트 어댑터는
> 한 글자도 바뀌지 않았다. 남은 열린 항목은 계획 §8 1단계 검증과 §9 미검증 10건이며,
> 모델은 `OPENROUTER_MODEL` 변경만으로 갈리므로 아래 모델 관련 서술이 조용히 낡을 수 있다.

# 파이프라인

```
크롭 이미지 dataURL
  → ① SAM 2 combined_mask (실패/토큰없음 → 건너뜀)
  → ② OpenRouter 비전 추론 (이미지 1~2장 + JSON Schema 강제)
  → ③ zod 검증 → 신뢰도 게이트
  → 정규화 [0..1] 폴리곤 배열
  → ④ 클라이언트: 캔버스 픽셀로 변환 + 처마 자동 지정
```

# ① SAM 마스크 — 있으면 좋고 없어도 되는 단계

`fetchSamMask` 는 Replicate 의 `meta/sam-2` 를 두 번의 HTTP 로 호출한다
(모델 메타에서 `latest_version.id` 조회 → `POST /v1/predictions` with `Prefer: wait=60`).

- **모든 실패 경로가 `null` 을 반환한다** — 토큰 미설정, HTTP 오류, 상태 실패, 출력 형식 불일치, 예외.
  호출자는 `null` 이면 원본 이미지 단독으로 진행한다. graceful degradation 이고, **조용하다** —
  `console.warn` 만 남으므로 SAM 이 계속 실패해도 사용자는 알 수 없다.
- `individual_masks` 로 중앙 건물만 고르는 방식은 **실패했다** — SAM 이 건물을 면·구조물 단위로 잘게 쪼개
  건물 크기 마스크가 나오지 않았다. 그래서 `combined_mask`(전 세그먼트 합집합)를 그대로 넘기고,
  섞여 든 옆 건물·그림자는 `EXTERNAL_HINT_BLOCK` 프롬프트로 모델이 거르게 한다.
- 마스크가 붙으면 이미지 파트가 2장(원본 → 마스크 순서)이 되고 시스템 프롬프트에 힌트 블록이 덧붙는다.
  **순서가 계약이다** — `EXTERNAL_HINT_BLOCK` 이 "second image" 를 지목한다.

# ② OpenRouter 호출

`POST https://openrouter.ai/api/v1/chat/completions` 를 **순수 `fetch`** 로 부른다. 전용 SDK 의존성이 없다
(저장소의 다른 외부 HTTP 호출 — `sam/replicate.ts`, `qsp/client.ts` — 과 같은 방식).
provider 인터페이스를 두지 않고 **완전 교체**했다: 호출부 1곳 + 구현 1개는 추상화 대상이 아니다.

| 설정 | 값 | 이유 |
|------|-----|------|
| 모델 | `process.env.OPENROUTER_MODEL` | 기본값 없음. 미설정이면 500. **현행값은 `openai/gpt-5.6-sol`** — 계획서 D3 가 잡았던 `google/gemini-3.1-pro-preview`(동일 모델 유지로 transport 영향만 분리)와 다르다. 즉 **transport 와 모델이 같이 바뀌었고**, 전환 전후 차이를 두 요인으로 분리할 수 없다 |
| 키 | `process.env.OPENROUTER_API_KEY` | `Authorization: Bearer`. 미설정이면 500 |
| `response_format` | `{ type: "json_schema", json_schema: { name, strict: true, schema } }` | 1차 계약. `strict` 는 **`json_schema` 안** (`response_format` 바로 아래에 두면 400). **zod 가 최종 SSOT** — strict 가 hint 로만 처리돼도 응답 보증은 zod 가 지킨다 |
| `max_tokens` | 32768 | **reasoning + output 합산** 예산. 작게 잡으면 reasoning 이 예산을 먹고 `finish_reason:"length"` + 빈 content → 502 |
| `reasoning` | `{ effort: "low", exclude: true }` | 생략하면 기본 thinking(high)으로 돌아 지연이 전환 전보다 악화된다. `exclude` 는 reasoning 텍스트가 `extractJsonPayload` 를 오염시키지 않게 한다. `effort` 와 `reasoning.max_tokens` 를 **동시 지정하지 않는다** |
| `provider` | `{ require_parameters: true }` | structured output / vision 미지원 엔드포인트를 배제한다. `order` pin 과 `allow_fallbacks:false` 는 채택하지 않았다 — 엔드포인트 장애 시 우회로를 스스로 막는 쪽의 손해가 더 크다 |
| `usage` | `{ include: true }` | **없으면 `usage.cost` 와 `reasoning_tokens` 가 응답에 실리지 않는다.** 아래 계측 표의 두 항목이 통째로 undefined 가 되므로 계측을 쓰려면 필수다 |
| 타임아웃 | `AbortController` · `UPSTREAM_TIMEOUT_MS = 180_000` | SDK 를 버리며 잃은 유일한 안전장치를 명시적으로 복구했다. 초과 시 업스트림 408 로 취급 → 클라이언트 502. **재시도는 없다** — 고비용 비멱등 호출 |
| 취소 전파 | `AbortSignal.any([req.signal, controller.signal])` | 클라이언트가 재크롭으로 fetch 를 끊으면(`utils/aiDetect.ts`) 상류 생성도 함께 끊는다. 연결하지 않으면 아무도 읽지 않을 응답을 최대 180초까지 만들며 **과금된다**. 두 신호는 로그에서 `controller.signal.aborted` 로 구분한다(`timeout after …` vs `client aborted`) |

content 배열은 **이미지 → 텍스트** 순서로 전환 전 `inlineData` parts 배치를 그대로 재현한다.
계약은 이미지끼리의 상대 순서뿐이고 텍스트 위치는 계약이 아니다.

응답은 `choices[0].message.content` → 기존 `extractJsonPayload`(그대로 / ```json 펜스 / 첫 `{`~마지막 `}`)
→ `JSON.parse` → zod. **검증 파이프라인은 전환 전과 동일하다.**

## 계측 (`[detect-roof] openrouter response`)

| 로그 필드 | 출처 |
|------|------|
| `finishReason` · `nativeFinishReason` | `choices[0]`. 프로바이더 원본 사유를 함께 남긴다 (예: `MAX_TOKENS`) |
| `promptTokens` · `completionTokens` · `reasoningTokens` · `totalTokens` | `usage` / `usage.completion_tokens_details`. **뺄셈하지 않고 원값으로** 남긴다 — `completionTokens` 가 reasoning 을 포함하는지 미확정 |
| `cost` | **신규** — `usage.cost`, 호출당 실비. 402(크레딧 소진) 대비 운영 지표. 요청의 `usage.include` 에 의존한다 |
| `resolvedModel` | **신규** — 응답 top-level `model`. 요청 슬러그와 실제 응답 모델이 갈리는지 본다 |
| `generationId` · `provider` | **신규** — 응답 top-level `id`(generation id)와 `provider`(옵셔널). fallback 을 살려두는 대신 **사후에** `GET /api/v1/generation?id=<generationId>` 로 실제 서빙 프로바이더를 조회한다 |
| `elapsedMs` | **신규** — wall-clock. 지연 진단 문서가 지적한 "측정 부재" 공백을 닫는다 |

> ⚠️ 계획 §3·§5·§6-① 이 전제한 **`X-OpenRouter-Metadata` 요청 헤더와 `openrouter_metadata` 응답 필드는 존재하지 않는다**
> (2026-07-30 공식 문서 실측). 문서화된 요청 헤더는 `HTTP-Referer` / `X-OpenRouter-Title` / `X-OpenRouter-Categories` 3개뿐이고,
> 비스트리밍 응답 top-level 은 `id` / `choices` / `created` / `model` / `object` / `system_fingerprint` / `usage` 다.
> 서빙 엔드포인트를 **응답에서 즉시 받는 경로는 없다** — generation id 를 남겨 사후 조회하는 것이 유일한 방법이다.
> `usage.cost` 와 `usage.completion_tokens_details.reasoning_tokens` 는 실재하므로 위 표의 나머지는 유효하다.

200 응답에 `choices[0].error` 가 실려 오는 경로는 결과가 빈 content 와 같은 502 지만
원인이 응답 본문에만 있어 **별도로 로깅**한다.

전환으로 생긴 장애 모드는 **402(크레딧 소진)** 하나다 → 502 + "서비스 설정 오류" 클래스
([`interfaces/detect-roof.md`](/interfaces/detect-roof.md) 의 업스트림 계약표).

# ③ 신뢰도 게이트

```ts
const CONFIDENCE_THRESHOLD = 0.5;
```

**어느 폴리곤 하나라도 임계값 미만이면 전체를 빈 배열로 차단**하고 `reason: "low_confidence"` 를 반환한다.
일부만 버리지 않는 이유는 결과가 지붕의 분할(PARTITION)이라 하나를 빼면 합집합에 구멍이 생기기 때문이다.

도로·들판을 잘못 크롭했을 때 모델이 그럴듯한 폴리곤을 환각해도 자가평가 신뢰도가 낮으면 여기서 막힌다.
`confidence` 는 **서버 전용**이고 클라이언트는 읽지 않는다.

`reason` 은 `"ok" | "no_polygons" | "low_confidence"` 셋이며 진단용으로만 노출된다.

# ④ 클라이언트 어댑터

`aiDetect.ts` 는 좌표 변환을 **서버가 아니라 캔버스 크기를 아는 시점까지 미룬다**.

```ts
normalizedToPixelPolygons(polygons, canvasW, canvasH)
  → { type: "install", points, eaveEdgeIndex: findLongestEdgeIndex(points) }[]
```

- 결과는 **전부 `install`** 로 매핑된다. 개구는 사용자가 직접 그린다.
- `eaveEdgeIndex` 를 가장 긴 변으로 자동 부여한다 — 분석 직후 바로 배치할 수 있어야 한다는 UX 약속.
- `id` 는 호출자(`CropPopup`)가 붙인다.
- 에러는 `DetectApiError`(status + code 보존)로 던진다. `AbortError` 는 호출자가 무시해야 한다.

# 사용자 흐름 상의 특징

- **수동 트리거**다. 크롭이 바뀌어도 자동 분석하지 않고 "AI 분석 시작" 버튼을 눌러야 한다.
- 이미 지붕면이 있으면 재분석 확인 창을 띄우고, 승인 시 `handleDeleteAll` + 경사/모듈/배치잠금까지 초기화한다.
- 실패는 **`alert` 하나**로만 알린다(배너 없음 — 기획 명시).
- 진행 중 요청은 `AbortController` 로 취소하며, 응답 도착 시 `abortControllerRef.current !== controller` 로 stale 응답을 버린다.

# 방어선

- 본문 크기: `arrayBuffer().byteLength` 로 직접 측정한다 — `Content-Length` 는 위조·누락 가능해서 신뢰하지 않는다.
  상한은 원본 5MB 를 base64(4/3배)로 환산한 값 + 256.
- 업스트림 오류는 클라이언트에 **429 만 그대로, 나머지는 502 로 클램프**하고 한국어 메시지 3종으로 치환한다.
  모델명·티어·키 출처 같은 provider 힌트는 서버 로그에만 남긴다.
- rate limit 은 별도 `detect` 버킷 10 req/min — [`system/security-perimeter.md`](/system/security-perimeter.md).
