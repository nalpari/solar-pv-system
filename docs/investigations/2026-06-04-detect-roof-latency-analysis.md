# detect-roof 지연 분석 — `/api/detect-roof` 성능 진단

> 작성일: 2026-06-04 · 대상: `src/app/api/detect-roof/route.ts` (지붕 형상 자동 감지 라우트)
> 방법: 코드 경로 정독(클라이언트→라우트→2단계 Gemini 호출) → 멀티에이전트 검증(genai SDK 문서 / Gemini 지연 벤치 / 코드 적대적 감사) → 합성
> 결과: 지배 요인 3건 + 보조 요인 6건 식별, 해결책 8건을 영향·노력·리스크로 우선순위화

---

## 1. 핵심 결론 (TL;DR)

detect-roof 지연의 **지배 요인 3가지**:

1. **`gemini-3.1-pro-preview`(thinking-Pro 모델)** 를 사용한다. 이 모델군은 **사고(thinking)를 끌 수 없다**(`thinkingBudget=0` 거부, 최소 `thinkingLevel:low`). 출력 첫 바이트 전에 사고 토큰을 직렬 생성하므로 TTFT(첫 토큰 지연)가 본질적으로 크다.
2. **그 Pro 호출을 2회, 완전 직렬·비스트리밍으로** 한다(`locateBbox` → `tracePolygon`). stage2는 stage1의 bbox에 의존해 합산되고, 전체 JSON 생성이 끝날 때까지 응답이 0바이트다.
3. **전송 전 이미지 다운스케일이 없다**(최대 25MP/5MB 원본 그대로). 큰 이미지일수록 모델이 ingest할 vision 입력 토큰(768px 타일당 258토큰)이 늘어 양쪽 stage의 prefill 지연이 커진다.

> ⚠️ **측정 먼저 (가장 중요):** 현재 라우트는 토큰 수(`usageMetadata`)만 로깅하고 **stage별 wall-clock(ms)을 전혀 로깅하지 않는다**(`route.ts:106-115`). "어느 단계가 실제로 지배적인가"는 코드만으로 **확정 불가**다. 외부 벤치(Artificial Analysis 측정 3.1 Pro TTFT ~27s, Flash-Lite 290 tok/s)는 *일반 벤치*이지 이 워크로드(위성+JSON)에서 재현된 값이 아니다. **해결책 #0(계측)을 가장 먼저** 적용해 실측한 뒤 나머지 우선순위를 확정한다.

---

## 2. 요청 흐름과 지연 구조

```
page.tsx ─ 단일 블로킹 await ─▶ /api/detect-roof
  detectStatus = "detecting"  (idle|detecting 단 2상태, 진행률 없음)
        │
        ▼ runTwoStageDetection (route.ts:309)
  ┌─ ① locateBbox     Pro 호출 #1  (전체 원본, thinkingBudget 1024, 비스트리밍)        ◀── 직렬
  ├─ ② cropToBbox     sharp: buffer 2회 디코드 + SVG 북방마커 합성 + PNG(무손실) 재인코딩
  └─ ③ tracePolygon   Pro 호출 #2  (크롭, thinkingBudget 4096, maxOut 32768, 비스트리밍)  ◀── 직렬
        │
        ▼ 두 호출이 끝나야 첫 응답 → 그동안 사용자는 frozen spinner
```

지연 합산식(개념):

```
total ≈ TTFT₁ + gen₁(thinking+bbox JSON)        # stage1
      + sharp(decode×2 + composite + PNG encode) # crop
      + TTFT₂ + gen₂(thinking+polygon JSON)       # stage2  ← 보통 최대 비용
```

stage2는 stage1 결과에 의존하므로 **병렬화 불가**. 합산이 wall-clock 바닥값이다.

---

## 3. 근본 원인 랭킹 (검증됨)

| # | 원인 | 영향 | 신뢰도 | 근거(코드/문서) |
|---|------|------|--------|------|
| 1 | **thinking-Pro 모델 2단계 사용** — `gemini-3.1-pro-preview`는 `thinkingBudget=0` 거부, 최소 `thinkingLevel:low`(minimal 미지원). 사고를 못 끔 | **지배적** | 높음 | `.env GEMINI_MODEL`, `route.ts:66-69` 주석, [thinking 문서](https://ai.google.dev/gemini-api/docs/thinking) |
| 2 | **2회 호출이 완전 직렬 + 비스트리밍** — 합산되고 첫 바이트까지 전체 대기 | **지배적** | 높음 | `route.ts:313-325`, `:76`(generateContent), `page.tsx:184` |
| 3 | **전송 전 다운스케일 부재** — 25MP 원본/크롭 그대로 → vision 토큰 선형 증가 → 양 stage prefill↑ | 높음 | 높음 | `route.ts:29, 83-86, 274-281`(`.extract()`만, `.resize()` 없음), [tokens 문서](https://ai.google.dev/gemini-api/docs/tokens) |
| 4 | **클라이언트 진행 피드백이 binary** — stage1 성공조차 비가시 → **체감 지연 증폭** | 높음 | 높음 | `page.tsx:55, 181-208`, `aiDetect.ts:58-79` |
| 5 | **sharp가 동일 buffer 2회 디코드** — metadata용 1회 + extract용 1회(25MP 전체 디코드 중복) | 중간 | 높음 | `route.ts:250-254` 와 `:274-281`의 별도 `sharp(buffer)` |
| 6 | **크롭을 무손실 `.png()` 재인코딩** — 위성 사진 PNG는 인코딩 느리고 페이로드 큼 → stage2 ingest 토큰까지 키움 | 중간 | 높음 | `route.ts:280`(옵션 없는 `.png()`) → `:285` base64 |
| 7 | **`maxDuration` export 부재** — 프록시 뒤 직렬 Pro 2회가 기본 타임아웃 초과 시 긴 대기 후 502/504. 재시도/백오프도 없음 | 중간 | 중간 | `route.ts:23`(runtime만), `:410-421` |
| 8 | **`no_polygons` 조기반환이 가장 비싼 stage2 *이후*** — 지붕 불명확 건물은 최대 파이프라인 전부 지불하고 빈 결과 | 낮음 | 높음 | `route.ts:326-335` (cf. `low_confidence`는 `:314-323` stage1 후) |
| 9 | **요청마다 `new GoogleGenAI`** — keep-alive/커넥션 재사용 부재(소폭) | 낮음 | 중간 | `route.ts:390`(POST 내부, 모듈 스코프 아님) |

---

## 4. 측정 공백 — "측정 먼저"

확정 진단을 막는, 현재 코드에 없는 측정:

- **stage별 wall-clock 부재** — `route.ts:106-115`는 토큰만 로깅. `locateBbox`/`cropToBbox`/`tracePolygon` 각 ms 미측정 → 지배 단계 확정 불가.
- **TTFT vs time-to-last-token 분해 부재** — 비스트리밍이라 사고 지연과 출력 생성 지연을 구분할 신호 없음.
- **sharp 단계별 CPU 시간 부재** — metadata/extract/composite/png 각 ms와 이중 디코드 실제 비용 미측정.
- **입력 이미지 실제 크기 분포 부재** — 25MP는 상한일 뿐. 운영 트래픽의 실제 픽셀/바이트와 `promptTokenCount` 분포 미집계 → 다운스케일 이득 추정 불가.
- **`candidatesTokenCount` 실측 분포 부재** — `maxOutputTokens=32768`이 실제 얼마나 쓰이는지(복잡 지붕 p95) 미집계 → 상한 현실화 안전선 못 정함.
- **`finishReason=MAX_TOKENS`(truncation) 발생률 부재** — 캡을 낮출 때 회귀 위험 baseline 없음.
- **upstream 타임아웃/502·504 발생률 부재** — `maxDuration` 미설정 상태의 실제 컷오프 발생 여부 미상.
- **정확도 baseline(IoU/경계 일치) 부재** — Flash 전환·thinking 축소의 정확도 회귀를 판정할 라벨링 위성 샘플·메트릭 없음.

---

## 5. 해결책 (우선순위 순)

| 순위 | 해결책 | 변경 위치 | 효과 | 노력 | 리스크 |
|------|--------|-----------|------|------|--------|
| **0** | **stage별 wall-clock 계측 먼저** — `performance.now()`로 stage1/crop/stage2/total ms를 기존 로그에 추가. 토큰↔지연 상관 확보 후 나머지 결정 | `route.ts:99-115, 309-343` | 높음 | 낮음 | 낮음 |
| **1** | **thinking 축소** — Pro 유지 시 `thinkingConfig.thinkingLevel:'low'` 명시(기본 high→low). ⚠️ `thinkingLevel`과 `thinkingBudget`을 **동시 지정 시 400** — 현재 `thinkingBudget` 코드를 `thinkingLevel`로 교체 | `route.ts:74, 97, 234-236` | 높음 | 낮음 | 중간 |
| **2** | **전송 전 다운스케일 + JPEG/WebP** — 한 변 ~1536px(≈2타일) 상한 `.resize({fit:'inside'})`, 크롭 `.png()`→`.jpeg({quality:90})`/`.webp`. Gemini 3는 `media_resolution:HIGH`로 이미지당 토큰 캡 가능 | stage1 `route.ts:83-86` 직전, stage2 `:274-281` | 높음 | 중간 | 중간 |
| **3** | **모델 티어 전환** — `DETECT_MODEL`을 stage별 분리(`GEMINI_BBOX_MODEL`). bbox는 `gemini-3.1-flash-lite-preview`/`gemini-3-flash-preview`로. polygon은 **Flash 1차 + Pro 폴백**(빈 결과/저신뢰 시 Pro 재시도) | `route.ts:31, 57-99, 179-206, 208-237` | 높음 | 중~높음 | 중~높음 |
| **4** | **sharp 이중 디코드 제거** — 단일 파이프라인 재사용(`.clone()` 또는 같은 인스턴스에서 metadata 후 extract) | `route.ts:250-281` | 중간 | 낮음 | 낮음 |
| **5** | **스트리밍 + 진행 UX** — `generateContentStream` + 라우트 `ReadableStream` 프록시, `detectStatus`를 `locating`/`tracing` 등 다단계로. ※ 총 시간은 thinking이 지배해 단축은 제한적이나 **타임아웃 회피 + 체감 개선** | `route.ts:76-99, 345-404`, `aiDetect.ts:54-80`, `page.tsx:55, 181-208` | 중간 | 높음 | 중간 |
| **6** | **`maxDuration` + 경량 재시도** — `export const maxDuration` 명시, 429/5xx에 1회 지수백오프 | `route.ts:23, 392-403` | 중간 | 낮음 | 낮음 |
| **7** | **`new GoogleGenAI` 모듈 스코프 호이스팅** — 무비용 win | `route.ts:390` | 낮음 | 낮음 | 낮음 |
| — | **2단계→1단계 통합은 비권장** — 호출 1회는 줄지만 크롭 해상도 집중·북방마커 azimuth 체계 약화 + 입력 토큰 오히려 증가. 정확도 회귀 위험 큼 | — | 낮음 | 높음 | 높음 |

---

## 6. 권장 실행 순서

1. **#0 (계측)** 먼저 머지 → 운영 로그로 stage1/stage2/sharp 각 ms와 `promptTokenCount` 분포 확보.
2. 실측으로 stage2(polygon) 지배 확인 시 → **#1(thinkingLevel low) + #2(다운스케일/JPEG)** 가 가장 저위험·고효과. 보통 여기서 **체감 절반 이하**로 떨어진다.
3. 그래도 부족하면 → **#3(모델 티어 전환)**. 위성 미세 지붕 경계는 Pro 우위 가능성 → **대표 위성 샘플 IoU/경계 A/B 검증 필수**(Flash 1차 + Pro 폴백 권장).
4. 사용자 체감은 → **#5(스트리밍/진행 UX) + #6(maxDuration)** 로 마무리.

> 모델 식별자(`gemini-3.1-flash-lite-preview` 등)는 출처 기반이나 **배포 환경에서 검증 후 `.env`로 주입**할 것 — 코드 하드코딩 금지. preview ID는 단종 일정(예: flash-lite-preview 2026-07-09 → stable 이관)이 있어 함께 관리한다.

---

## 부록 A. 검증된 외부 근거 (출처)

genai SDK / Gemini 문서 조사에서 확인한 사실(출처 URL 포함):

- **thinking 비활성 가능 모델**: `thinkingBudget=0`(완전 비활성)은 **Gemini 2.5 Flash / 2.5 Flash-Lite 에서만** 허용. **2.5 Pro / 3 Pro / 3.1 Pro 는 사고를 끌 수 없다**(최소 `thinkingLevel:low`, minimal 미지원). — [thinking 문서](https://ai.google.dev/gemini-api/docs/thinking)
- **`thinkingLevel` vs `thinkingBudget`**: Gemini 3 계열에서 **둘을 같은 요청에 동시 지정하면 400**. 3.1 Pro는 low·medium·high(high 기본), Flash/Flash-Lite는 minimal 지원. — [Gemini 3 가이드](https://ai.google.dev/gemini-api/docs/gemini-3)
- **이미지 토큰화**: 양변 ≤384px → 258토큰. 더 크면 768×768 타일로 분할, **타일당 258토큰**. `media_resolution`(LOW 280 / MEDIUM 560 / HIGH 1120 / ULTRA_HIGH 2240)로 이미지당 토큰 캡 가능. 다운스케일은 prefill 토큰/지연을 직접 절감. — [image-understanding](https://ai.google.dev/gemini-api/docs/image-understanding), [tokens](https://ai.google.dev/gemini-api/docs/tokens)
- **inline vs Files API**: 단발 호출이고 총 요청 < 20MB면 `inlineData`(base64)가 적합 — Files API 업로드 왕복은 1회성 요청 지연을 오히려 늘린다. 토큰 수는 **픽셀 차원 기준이라 포맷(PNG/JPEG/WebP)과 무관**이나, JPEG/WebP가 동일 화질 대비 바이트가 작아 업로드 전송 지연을 줄인다. — [image-understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- **structured output(responseSchema)**: controlled decoding 기반으로 **지연을 거의 추가하지 않으며**, 유효 JSON 보장으로 파싱 실패 재호출(추가 왕복)을 줄이는 순효과. 단 스키마 크기는 입력 토큰에 산입. → **현행 유지 권장.** — [structured outputs](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-structured-outputs/)
- **streaming**: `generateContentStream`은 청크 AsyncGenerator를 반환해 **TTFT 체감/타임아웃을 완화**하나, 모델이 thinking-Pro면 사고 단계 자체는 단축하지 못한다(총 처리시간은 thinking 지배). — [js-genai README](https://github.com/googleapis/js-genai/blob/main/README.md)
- **모델 속도(일반 벤치, 워크로드 비재현)**: Artificial Analysis 측정 — 3.1 Pro Preview 출력 ~138 tok/s·TTFT ~27s vs Flash-Lite ~290 tok/s. "deeper reasoning = slower responses". — [Artificial Analysis](https://artificialanalysis.ai/models/gemini-3-1-pro-preview)
- **segmentation 권고**: 공식 image-understanding 문서가 segmentation에 "thinking level을 minimal로 낮춰라"고 권고. vision 품질 기여는 수백 토큰에서 포화 경향(단 다중 지붕면 기하 추론 케이스는 A/B 검증 권장). — [image-understanding](https://ai.google.dev/gemini-api/docs/image-understanding)

## 부록 B. 진단 방법

- 코드 경로 정독: `route.ts`, `src/lib/detect/{schema,prompt,overlay}.ts`, `src/app/utils/aiDetect.ts`, `src/app/page.tsx`(detectRoofs 호출부)
- 멀티에이전트 검증(4 agents): genai SDK 문서 조사 / Gemini 지연 벤치 조사 / 코드 적대적 감사 → 합성. 적대적 감사가 1차 요약이 놓친 항목 보강(예: `no_polygons`가 stage2 *이후* 반환 / `maxDuration` 부재 / 커넥션 재사용 부재).
