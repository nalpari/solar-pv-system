---
type: Module
title: AI Roof Detection
description: 크롭 이미지에서 지붕면 폴리곤을 자동 감지한다. SAM 2 마스크(선택) + Gemini Vision + 신뢰도 게이트 3단 구성.
resource: src/app/api/detect-roof/route.ts
tags: [module, ai, gemini, sam, vision]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
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
    title: OpenRouter 전환 계획 (설계 확정 / 구현 미착수)
    last_modified: 2026-07-27
  - id: latency
    resource: docs/investigations/2026-06-04-detect-roof-latency-analysis.md
    title: 지연 진단
    last_modified: 2026-06-04
---

> ⚠️ **stale_after 2026-10-27** — `docs/plans/2026-07-27-gemini-to-openrouter-migration.md` 가
> Gemini 직접 호출을 OpenRouter Chat Completions 로 바꾸는 설계를 확정했다(구현 미착수).
> 착수되는 순간 아래의 "Gemini 호출" 절은 무효가 된다. 프롬프트·SAM·후처리·클라이언트 어댑터는 바뀌지 않는다.

# 파이프라인

```
크롭 이미지 dataURL
  → ① SAM 2 combined_mask (실패/토큰없음 → 건너뜀)
  → ② Gemini Vision (이미지 1~2장 + JSON 스키마 강제)
  → ③ zod 검증 → 신뢰도 게이트
  → 정규화 [0..1] 폴리곤 배열
  → ④ 클라이언트: 캔버스 픽셀로 변환 + 처마 자동 지정
```

# ① SAM 마스크 — 있으면 좋고 없어도 되는 단계

`fetchSamMask` 는 Replicate 의 `meta/sam-2` 를 두 번의 HTTP 로 호출한다
(모델 메타에서 `latest_version.id` 조회 → `POST /v1/predictions` with `Prefer: wait=60`).

- **모든 실패 경로가 `null` 을 반환한다** — 토큰 미설정, HTTP 오류, 상태 실패, 출력 형식 불일치, 예외.
  호출자는 `null` 이면 Gemini 단독으로 진행한다. graceful degradation 이고, **조용하다** —
  `console.warn` 만 남으므로 SAM 이 계속 실패해도 사용자는 알 수 없다.
- `individual_masks` 로 중앙 건물만 고르는 방식은 **실패했다** — SAM 이 건물을 면·구조물 단위로 잘게 쪼개
  건물 크기 마스크가 나오지 않았다. 그래서 `combined_mask`(전 세그먼트 합집합)를 그대로 넘기고,
  섞여 든 옆 건물·그림자는 `EXTERNAL_HINT_BLOCK` 프롬프트로 Gemini 가 거르게 한다.
- 마스크가 붙으면 이미지 파트가 2장(원본 → 마스크 순서)이 되고 시스템 프롬프트에 힌트 블록이 덧붙는다.
  **순서가 계약이다.**

# ② Gemini 호출

| 설정 | 값 | 이유 |
|------|-----|------|
| 모델 | `process.env.GEMINI_MODEL` | 기본값 없음. 미설정이면 500 |
| `responseMimeType` | `application/json` | |
| `responseSchema` | `DETECT_RESPONSE_SCHEMA` | points 3~64개, 각 좌표 0~1 |
| `maxOutputTokens` | 32768 | Gemini 3.1 Pro 에서 이 예산은 **thinking + output 합산**이다. 복잡한 지붕은 10~15K 를 태울 수 있다 |
| `thinkingBudget` | 4096 | 지연을 줄이려고 추론 깊이를 일부 포기. `0` 은 거부되므로 양수 상한으로 |

응답 텍스트는 `extractJsonPayload` 로 세 단계 추출(그대로 / ```json 펜스 / 첫 `{`~마지막 `}`) 후 `JSON.parse` → zod.

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
