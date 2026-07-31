# 지붕면 감지 추론을 Gemini 직접 호출 → OpenRouter 경유로 전환하는 계획

> **대상**: `POST /api/detect-roof` (`src/app/api/detect-roof/route.ts`, 293줄)
> **목표**: 추론 호출 계층만 OpenRouter API 로 교체. **모델 교체가 핵심이며 그 외 비즈니스 로직은 변경하지 않는다**
> **작성 방식**: Opus 5(lead) + Claude Fable 5 + GPT-5.6-Sol 3자 멀티에이전트 설계 토론 후 lead 종합. OpenRouter 공식 문서 + 공개 endpoints 메타 API 실측 + 저장소 grep 검증 기반
> **상태**: 설계 확정 / **1차 전환(transport 교체) 구현 완료 — 2026-07-30**. 코드·`Jenkinsfile`·문서 반영됨.
> 남은 것: §8 1단계 검증(1.2 canary · 1.3~1.7 골든셋 A/B·로그 실측) 미실시, §9 미검증 항목 10건 미해소.
> **⚠️ D3 무효** — 실제 배포 `OPENROUTER_MODEL` 은 `openai/gpt-5.6-sol` 이다. D3 가 전제한 "현행과 동일 모델(`google/gemini-3.1-pro-preview`)" 이 아니므로 **transport 교체의 영향만 분리한다는 1단계의 목적 자체가 성립하지 않는다.** 결과적으로 §8 2단계(모델 교체)가 1단계에 섞여 이미 일어났다. Gemini 모델 특성에 기댄 §6·§9 의 판단(서빙 프로바이더가 전부 Google · Flash 후보 슬러그 · thinking 예산 환산)은 재검토 대상이다.
> 아래 본문은 **설계 기록**이므로 갱신하지 않는다 — 구현 결과와 어긋나는 곳이 생기면 `docs/okf/` 를 진실의 원천으로 삼는다.

---

## 1. 개요

현재 `/api/detect-roof` 는 `@google/genai` SDK 로 Gemini(`GEMINI_MODEL`)를 직접 호출한다.
본 계획은 이 호출을 OpenRouter Chat Completions 로 바꾼다. 얻는 것은 **모델 교체가 env 변경만으로 가능해지는 것**이다.

### 핵심 인사이트

이 라우트는 이미 provider-neutral 경계를 갖고 있다.

- **입력 경계**: `parseDataUrl` + POST 바디 검증 — provider 무관
- **출력 경계**: `extractJsonPayload()` → `DetectResponseSchema.safeParse()`(zod SSOT) → 신뢰도 0.5 게이트 — provider 무관
- **provider 의존 구역은 4곳뿐**: ① 호출 함수 `callGeminiJson` ② `Type`/`Schema` 스키마 표기 ③ `ApiError` 기반 에러 매핑 ④ usage 로그 필드

→ 이 4구역만 교체하면 전환이 끝난다. 프롬프트·SAM·후처리·클라이언트 어댑터는 **한 글자도 바뀌지 않는다**.

---

## 2. 의사결정 매트릭스 (확정)

| # | 결정 | 확정 내용 |
|---|------|---------|
| D1 | 호출 계층 | **순수 `fetch`**. 신규 의존성 0. `openai` SDK + baseURL / Vercel AI SDK 모두 불채택 — 비스트리밍 단발 호출이고, 저장소가 이미 외부 HTTP 를 전부 fetch 로 호출한다(`sam/replicate.ts`, `qsp/client.ts`) |
| D2 | 추상화 | **provider 인터페이스 만들지 않음**. 호출부 1곳 + 구현 1개 = YAGNI 위반. 완전 교체 |
| D3 | 1차 모델 | **`google/gemini-3.1-pro-preview`** — 현행과 동일 모델. transport 교체의 영향만 분리하기 위함 |
| D4 | 모델 교체 | 1차 전환과 **분리된 2단계**. `OPENROUTER_MODEL` env 변경만으로 수행. Flash 후보 슬러그는 2단계 진입 시점에 models API 로 재확인해 확정 |
| D5 | structured output | `response_format: json_schema, strict:true` 를 1차 계약, **zod 를 최종 SSOT 로 유지**. 런타임 자동 강등 / Response Healing / 모델 자동 폴백 **미도입** |
| D6 | reasoning | `max_tokens: 32768` 유지 + `reasoning: { effort:"low", exclude:true }`. `thinkingBudget:4096` 의 1:1 이식은 **불가능** (Gemini 3 계열은 토큰 예산을 내부적으로 level 로 재매핑) |
| D7 | provider 라우팅 | `provider: { require_parameters: true }` **만**. `order`/`allow_fallbacks:false` 불채택(§6-①). `zdr:true` 는 canary 200 확인 후 채택 |
| D8 | 에러 노출 | 현행 규약 유지 — **429 만 passthrough, 나머지 전부 502 클램프** + 기존 한국어 메시지 3종. 402(크레딧 소진)는 401/403 클래스로 취급 |
| D9 | 타임아웃 | `AbortController` **필수 추가**. SDK 를 버리며 잃는 유일한 안전장치. `qsp/client.ts:113-121` 패턴 재사용. 재시도는 추가하지 않음(고비용 비멱등 호출) |
| D10 | content 배열 순서 | **이미지 → 텍스트** (현행 `inlineData` parts 순서 재현). 이미지끼리 순서(원본 → SAM 마스크)가 계약이고 text 위치는 계약이 아님 — 변경 최소 원칙 우선 |
| D11 | 의존성 | **`@google/genai` 완전 제거**. 코드 import 는 `route.ts` 1곳뿐(grep 확정). `pnpm-workspace.yaml` 의 `allowBuilds` 2줄도 함께 제거(§4) |
| D12 | env 네이밍 | `OPENROUTER_API_KEY` / `OPENROUTER_MODEL`. 현행처럼 **키/모델 분리 유지** → "모델 교체는 env 만" 원칙 계승 |
| D13 | 롤백 | **git revert (또는 이전 Docker image tag 재배포)**. env 스위치 양립 불채택 — `@google/genai` 를 제거하지 못해 전환 목표가 훼손되고, 이 프로젝트는 env 변경 자체가 Jenkins 재배포를 요구하므로 env 스위치의 이득이 0에 수렴 |

---

## 3. 요청 형태 (확정)

```ts
// POST https://openrouter.ai/api/v1/chat/completions
// headers: Authorization: Bearer ${OPENROUTER_API_KEY}
//          Content-Type: application/json
//          X-OpenRouter-Metadata: enabled     // 실제 서빙 엔드포인트 진단용
{
  model: process.env.OPENROUTER_MODEL,          // "google/gemini-3.1-pro-preview"
  messages: [
    { role: "system", content: systemPrompt },  // ROOF_DETECT_SYSTEM_PROMPT (+ EXTERNAL_HINT_BLOCK)
    { role: "user", content: [
        // 현행 inlineData parts 와 동일 순서: 원본 → (있으면) SAM 마스크 → 텍스트
        ...images.map(img => ({ type: "image_url",
          image_url: { url: `data:${img.mediaType};base64,${img.base64}` } })),
        { type: "text", text: userPrompt },
    ]},
  ],
  max_tokens: 32768,                            // reasoning + output 합산 예산 (현행 maxOutputTokens 와 동일 의미축)
  reasoning: { effort: "low", exclude: true },  // exclude: reasoning 텍스트가 extractJsonPayload 를 오염시키지 않게
  response_format: { type: "json_schema", json_schema: {
    name: "roof_faces", strict: true, schema: DETECT_JSON_SCHEMA } },
  provider: { require_parameters: true },       // canary 통과 후 zdr: true 추가
}
```

응답은 `choices[0].message.content` → **기존** `extractJsonPayload()` → **기존** zod `safeParse` 로 흘린다. 검증 파이프라인은 무변경.

### JSON Schema 재작성 규칙

현행 `POLYGON_SCHEMA` / `DETECT_RESPONSE_SCHEMA`(genai `Type`/`Schema`)를 표준 JSON Schema 리터럴로 옮긴다.

- `minItems: "3"` 같은 **문자열 정수 → 숫자** (`3`) — genai SDK 특유 표기가 정상화되는 부수 이득
- 모든 object 에 `additionalProperties: false` 추가 (strict 모드 요건)
- `required` 는 현행 그대로 (`polygons` / `points`,`confidence`) — 이미 전 프로퍼티 필수라 strict 요건과 충돌 없음
- `reason` 은 모델 출력 스키마에 **넣지 않는다** — 서버 후처리가 붙이는 값 (현행과 동일)

---

## 4. 변경 파일 (전수)

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/api/detect-roof/route.ts` | **본체.** `@google/genai` import 4종 제거 / `callGeminiJson`(50–125) → fetch 기반 교체 + `AbortController` / 스키마(127–160) 표준 JSON Schema 재작성 / env 읽기(24, 218–226) / `respondWithUpstreamError`(282–293) status 기반 재구성 / 로그 필드 매핑. **`parseDataUrl`·`extractJsonPayload`·`detectRoofPolygons` 후처리(신뢰도 0.5 게이트)·POST 바디 검증은 무변경** |
| `package.json` + `pnpm-lock.yaml` | `@google/genai` 제거. 신규 의존성 0 |
| `pnpm-workspace.yaml` | `allowBuilds` 의 `'@google/genai': false` **와 `protobufjs: false` 둘 다 삭제** — `pnpm why protobufjs` 로 protobufjs 가 `@google/genai` 단독 유래임을 확인 |
| `Jenkinsfile` 62–63 | `GEMINI_API_KEY`/`GEMINI_MODEL` 전수 검증 2줄 → `OPENROUTER_*` |
| Jenkins credential `pv-common-env` + 로컬 `.env` | 두 키 추가. **`GEMINI_*` 는 안정화 관측 기간 삭제하지 않음** — 여분 키는 Validate Environment 를 실패시키지 않아 무해하고 롤백 대비가 된다 |
| `CLAUDE.md` | Tech Stack(`@google/genai` 행) / Architecture 디렉터리 주석 / env 표 2행 / detect-roof rate limit 사유 문구("Gemini Vision 단일 호출…") |
| `README.md` | 기능 설명(10) / 의존성 표(33–34) / 사전 요구사항(45) / `.env` 예시(57) / `docker run -e` 예시(100) / env 표(210) |
| `src/lib/openapi.ts` | **설명 문자열만** provider-neutral 화 ("Gemini Vision" → "AI vision", "Upstream(Gemini)" → "upstream inference"). 스키마·status 계약 무변경 |
| `docs/investigations/2026-06-04-detect-roof-latency-analysis.md` | (선택) call graph 정정 — §7 참조 |

### 변경 불필요 (검증 완료)

`src/lib/detect/schema.ts`(zod SSOT) · `src/lib/detect/prompt.ts` · `src/lib/sam/replicate.ts` · `src/app/utils/aiDetect.ts`(클라이언트) · `Dockerfile` · `docker-compose.yml`(GEMINI 참조 0건, `env_file: .env` 통째 주입이라 새 키 자동 전달) · `.env.dev`/`.env.prod`(키·모델이 dev/prod 공통) · `src/proxy.ts`(per-IP 10회/분 detect 버킷 그대로 유효)

---

## 5. 계측 이식 (진단 로깅)

`docs/investigations/2026-06-04-*.md` 가 이 로그에 의존하므로 지표 손실 없이 옮긴다. 로그 키는 `"[detect-roof] gemini response"` → `"[detect-roof] openrouter response"`.

| 현행 (Gemini) | OpenRouter 대응 |
|---|---|
| `finishReason` | `choices[0].finish_reason` + `native_finish_reason`(프로바이더 원본, 예: MAX_TOKENS) 병기 |
| `promptTokenCount` | `usage.prompt_tokens` |
| `candidatesTokenCount` | `usage.completion_tokens` 와 `reasoning_tokens` 를 **각각 원값으로** 로깅 (뺄셈은 분석 시점 — 동치성 미검증) |
| `thoughtsTokenCount` | `usage.completion_tokens_details.reasoning_tokens` |
| `totalTokenCount` | `usage.total_tokens` |
| — | **신규**: `usage.cost`(호출당 실비) / resolved `model` / `openrouter_metadata` 의 선택된 엔드포인트 / `elapsedMs`(`performance.now()` 차이 2줄) |

`elapsedMs` 추가로 latency 문서가 지적한 "wall-clock 계측 부재" 공백이 닫힌다.

---

## 6. 3자 토론에서 상충했고 lead 가 판정한 지점

### ① `provider` 블록의 범위 — 최소 채택

- **Fable(실측 근거)**: `google/gemini-3.1-pro-preview` 의 엔드포인트 6개가 **전부 Google 자체 서빙**(Vertex ×3 + AI Studio ×3, 공개 endpoints 메타 API 확인). 서드파티 프로바이더가 애초에 없어 `order` pin·`allow_fallbacks:false` 는 결정성 이득이 없다. `zdr`/`data_collection` 선제 지정은 503(요건 충족 프로바이더 없음)으로 전멸 위험
- **Sol(정책 근거)**: 고객 건물 위성 이미지이므로 `order:["google-vertex"] + allow_fallbacks:false + require_parameters:true + data_collection:"deny" + zdr:true` 전량 명시

**판정**: `require_parameters:true` **무조건 채택**(비용 0, structured output/vision 미지원 엔드포인트 배제라는 확실한 이득). `order` + `allow_fallbacks:false` **불채택** — 종착지가 어차피 Google 뿐이라 결정성 이득이 없는데 엔드포인트 장애 시 우회로를 스스로 막는다(실측 시점 한 엔드포인트의 5분 uptime 87% 관측). 데이터 정책 목표는 `zdr:true` 하나로 달성되므로 order pin 은 중복 → **`zdr:true` 는 canary 200 확인 후 채택**. fallback 을 살려두는 대신 `X-OpenRouter-Metadata: enabled` 로 실제 서빙 엔드포인트를 로그에 남긴다.

### ② content 배열의 text 위치 — 현행 재현

- Fable: 이미지 → 텍스트 (현행 parts 순서)
- Sol: OpenRouter 문서가 text 먼저를 권고 → 텍스트 → 원본 → 마스크

**판정**: 계약은 **이미지끼리의 상대 순서**(원본 → SAM 마스크)뿐이다 — `EXTERNAL_HINT_BLOCK` 이 "second image"를 참조하므로. text 위치는 계약이 아니므로 변경 최소 원칙에 따라 **현행 재현**. text-first 권고는 lead 가 교차 검증하지 못했으므로 §8 미검증 항목으로 남기고, 파싱 품질 문제 관측 시 스위치.

### ③ 검증 규모 — 2단계로 분리

- Fable: 8~10장 골든셋 + `reason` 일치 + 육안
- Sol: 30장 ×3회 + union IoU / face-count exact rate blind 채점 + acceptance 수치(IoU −0.02, face-count −5%p)

**판정**: 두 사람이 **다른 단계를 말하고 있다**. 1차는 동일 모델 + transport 교체뿐이라 회귀 표면이 작으므로 8~10장으로 충분. 30장 정량 IoU 게이트는 **실제로 모델을 바꾸는 2단계**에 적용. 지금 30장을 1단계에 걸면 transport 커밋이 모델 품질 심사에 인질로 잡힌다.

---

## 7. 에러 매핑표

| OpenRouter 상태 | 의미 | 클라이언트 응답 (현행 규약 유지) |
|---|---|---|
| 429 | rate limit | **429** + "요청이 일시적으로 많습니다…" |
| 401 | 키 무효 | 502 + "서비스 설정 오류로…" |
| **402** | **크레딧 부족 (신규 장애 모드)** | 502 + "서비스 설정 오류로… 관리자에게 문의" — 관리자 조치 필요라는 점에서 401/403 클래스 |
| 403 | 권한/moderation | 502 + "서비스 설정 오류로…" |
| 400 / 404 / 408 / 413 / 502 / 503 | 요청·라우팅·업스트림 오류 | 502 + "분석 서비스가 일시적으로 응답하지 않습니다…" |
| **200 + `choices[0].error`** | **신규**: 생성 중 오류가 200 에 실려 옴 | 502 (현행 "텍스트 응답 없음" 경로와 동일 결과). **원인 로깅용 분기 1개 추가 가치 있음** |
| `finish_reason:"length"` / 빈 content | 예산 소진 | 502 (현행과 동일) |

`ApiError` instanceof 분기 대신, fetch 헬퍼가 `!res.ok` 일 때 status + 파싱된 message 를 담은 로컬 에러를 던지고 catch 에서 매핑한다. 프로바이더 힌트는 **서버 로그에만** — 현행 격리 정책 유지.

### reasoning 오이식 실패 모드 (주의)

- `max_tokens` 를 thinking 예산으로 오해해 작게 설정 → reasoning 이 예산 소진 → `finish_reason:"length"` + 빈 content → 502. **32768 유지로 회피**
- `reasoning` 필드 **생략** → Gemini 3.1 Pro 기본 thinking(high)으로 동작 → 지연이 **현행보다 악화**. 반드시 명시
- `effort` 와 `reasoning.max_tokens` **동시 지정 금지** (Gemini 직접 호출의 thinkingLevel+thinkingBudget 동시 지정 400 과 유사한 충돌 여지)

---

## 8. 검증 계획

### 1단계 — transport 교체 (동일 모델)

| # | 항목 | 판정 기준 |
|---|------|----------|
| 1.1 | 정적 | `pnpm lint` + `npx tsc --noEmit` (Stop 훅 자동) + 큰 변경이므로 `pnpm build` 수동 1회 |
| 1.2 | **배포 전 canary** | 최대 크기 근접 원본 + SAM 마스크 2장 + strict 스키마 전체 키워드 + `require_parameters` 조합을 실제 키로 1회 호출 → 200 + 엔드포인트 메타 확인. **여기서 `zdr:true` 도 켜보고 200 이면 채택, 503 이면 보류** |
| 1.3 | 골든셋 A/B | 대표 크롭 8~10장(박공2면 / 모임4면 / L자6면+ / 평지붕 / 개구부 / 비지붕) × 2~3회(모델 비결정성). 전환 전 브랜치와 전환 브랜치에 동일 요청 JSON 을 `curl` 재생 |
| 1.4 | A/B 판정 | ① `reason` 일치 — 특히 **비지붕 → `low_confidence`/`no_polygons` 차단 유지**(신뢰도 0.5 게이트 회귀) ② 폴리곤 수 분포 동급 ③ zod 502율 0 유지 ④ CropPopup 오버레이 육안 비교 |
| 1.5 | SAM 2-이미지 경로 | `REPLICATE_API_TOKEN` 설정 1회(마스크가 2번째로 인식되는지 = D10 순서 검증 겸용) / 미설정 1회(단독 경로) |
| 1.6 | 에러 경로 | 잘못된 키 → 502 "서비스 설정 오류" / 없는 슬러그 → 502 |
| 1.7 | 로그 실측 | 토큰 4종 + finish_reason 전부 non-null. `completion_tokens` 의 reasoning 포함 여부 확정(§5) |

### 2단계 — 모델 교체 (Flash 등)

Sol 이 설계한 30장 × 3회 정량 게이트를 적용한다. 샘플 구성: gable 5 / hip 5 / flat 4 / L·U·복합 6 / 부분가림·그림자 5 / no-roof 5.

- 자동 게이트: HTTP 200 + zod 유효 100%, 좌표·점수 위반 0, `length`/빈 content/502 신규 발생 0, **no-roof false positive 0**
- 기하 게이트: 기존 `polygon-clipping` 의존성을 쓰는 일회성 스크립트로 **union IoU** 계산 + face-count exact rate + gap/overlap 을 모델명 가린 blind 채점. union IoU 만으로 내부 면 분할 회귀를 판정하지 않는다
- Acceptance: 평균 union IoU 가 baseline 대비 −0.02 이내, face-count exact rate −5%p 이내, no-roof false positive 증가 0. 3회 중 **최악 결과도 별도 확인**
- 지연 게이트: p50/p95 + reasoning tokens + SAM 유무 분리

테스트 프레임워크나 fixture suite 를 저장소에 넣지 않는다. 일회성 evidence bundle 로 충분하다.

---

## 9. 리스크 & 미검증 항목

### 리스크 Top 3

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | **structured output 엔드포인트 편차** — 모델 페이지가 `response_format` 을 지원해도 엔드포인트가 strict 를 hint 로만 처리하거나 키워드 subset 이 다를 수 있음 | `require_parameters:true` + zod 최종 게이트(현행과 동일 동작) + 배포 전 canary |
| 2 | **과금·가용성 축 추가** — 402(크레딧 소진)라는 새 장애 모드, 완전 교체이므로 OpenRouter 자체 장애 시 우회 수단 없음 | 402 에러 매핑 + `usage.cost` 로깅 + 크레딧 잔액 운영 체크 + git revert 1커밋 롤백 |
| 3 | **데이터 경유지 추가** — 고객 건물 위성 이미지가 OpenRouter 를 경유. 서빙 종착지는 Google 로 동일하지만 경유지가 1개 늘어나는 것은 사실 | 계정 로깅 opt-out 확인 + 필요 시 약관/DPA 검토를 **도입 게이트**로. 이는 기술 판단이 아니라 사업 판단 |

### 미검증 항목

| # | 항목 | 대응 |
|---|------|------|
| 1 | strict 모드에서 `minItems`/`maxItems`/`minimum`/`maximum` 의 실제 통과 여부 (OpenRouter 문서가 지원 키워드를 열거하지 않음) | zod 가 전 제약을 최종 강제(현행 동일). 프로바이더 400 시 제약 키워드 축소 |
| 2 | 요청 바디 크기 상한 (공식 수치 없음). 원본 5MB + SAM 마스크면 10MB 대 가능 | canary(1.2)로 실측. 초과 시 이미지 다운스케일 논의 — latency 문서 #2와 시너지 |
| 3 | content 배열 내 이미지 순서의 Gemini parts 변환 보존 | 1.5 SAM 경로 테스트로 실증(마스크는 흑백이라 뒤바뀌면 결과 붕괴가 즉시 드러남) |
| 4 | content 배열 text 위치 권고 (§6-②) | 파싱 품질 문제 관측 시 text-first 로 스위치 |
| 5 | OpenRouter 자체의 프롬프트/이미지 보존 정책 (docs 는 프로바이더 정책만 확답) | 도입 게이트 — 계정 설정 + 약관/DPA |
| 6 | `usage.completion_tokens` ↔ Gemini `candidatesTokenCount`+`thoughtsTokenCount` 대응 관계 | 1.7 로그 실측으로 확정. 프로바이더가 breakdown 을 주지 않으면 `reasoning_tokens` 지표를 **잃는다** |
| 7 | `effort:"low"` ↔ `thinkingBudget:4096` 실효 등가성 (토큰량은 Google 내부 결정) | `reasoning_tokens` 실측 비교. 품질 저하 시 `medium` 상향 |
| 8 | OpenRouter 홉의 실측 추가 지연 (공식 수치 없음) | `elapsedMs` 로깅으로 자동 해소. 일반적으로 수십 ms 급이라 thinking TTFT 대비 노이즈 수준으로 추정 |
| 9 | Flash 후보 슬러그 (Fable `google/gemini-3-flash-preview` vs Sol `google/gemini-3.5-flash`) | 2단계 진입 시 models API 로 실재·vision·structured_outputs 재확인. **1단계 결정에 영향 없음** |
| 10 | Gemini 슬러그의 서빙 프로바이더가 향후 Google 외로 확장될 가능성 | 비Google 엔드포인트 등장 또는 비Google 모델 채택 시 `provider` 정책 옵션 추가를 **조건부 규칙**으로 유지 |
| ~~11~~ | ~~`X-OpenRouter-Metadata: enabled` 로 실제 서빙 엔드포인트를 응답에서 받는다 (§3 요청 헤더 · §5 표 마지막 행 · §6-① 판정 마지막 문장 · §8 1.2 의 "엔드포인트 메타 확인")~~ | **해소 — 그런 메커니즘은 애초에 없었다** (2026-07-30 공식 문서 실측). 문서화된 요청 헤더는 `HTTP-Referer` / `X-OpenRouter-Title` / `X-OpenRouter-Categories` **3개뿐**이고, 비스트리밍 응답 top-level 은 `id` / `choices` / `created` / `model` / `object` / `system_fingerprint` / `usage` 로 **`openrouter_metadata` 필드가 없다.** 구현은 응답 `id`(generation id) + 옵셔널 `provider` 를 로깅하고 실제 서빙 프로바이더는 **사후** `GET /api/v1/generation?id=<id>` 로 조회하는 방식으로 교체됐다. §6-① 의 "fallback 을 살려두는 대신 서빙 엔드포인트를 로그에 남긴다"는 판정 근거 자체는 유지되지만 **획득 시점이 즉시 → 사후로 바뀐다.** §5 의 `usage.cost` 와 `usage.completion_tokens_details.reasoning_tokens` 는 실재하므로 무영향 |

---

## 10. 부수 발견 — latency 조사 문서와 현재 코드의 불일치

두 워커가 **독립적으로** 지적하고 lead 가 확인한 사항.

`docs/investigations/2026-06-04-detect-roof-latency-analysis.md` 는 `locateBbox → sharp crop → tracePolygon` 의 **Gemini 2회 직렬 호출 + sharp** 파이프라인을 전제한다. 그러나 현재 `route.ts` 는 **`SAM(선택) → 단일 추론`** 이며 sharp 도 없다. 문서가 참조하는 `route.ts:390` 은 293줄 파일에 **존재하지 않는다**.

- **무효**: "2회 직렬 호출이 지배적" 결론, 라인 참조 전반
- **여전히 유효**: thinking-Pro 지배 / 큰 base64 이미지 / 비스트리밍 / wall-clock 계측 부재

→ 본 전환은 그 문서와 충돌하지 않는다. 오히려 **#1(thinking 축소)을 `effort:"low"` 로 이행**하고, **#3(모델 티어 전환)을 env 만으로 가능하게** 하며, **wall-clock 공백을 `elapsedMs` 로 닫는다**. 다만 문서의 call graph 와 근본원인 순위는 정정이 필요하다 — 이는 비즈니스 로직 변경이 아니라 진단 문서 정정이다.

---

## 11. 커밋 단위

전환을 **의미 단위 커밋 1개**로 만든다 (코드 + `Jenkinsfile` + 문서). git revert 롤백이 원자적으로 성립하기 위한 조건이다.

`docs/investigations/*` 정정과 2단계 모델 교체는 각각 별도 커밋.
