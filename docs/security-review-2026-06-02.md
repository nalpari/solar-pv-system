# 보안 리뷰 보고서 — Solar PV System BFF/Detect API

> 작성일: 2026-06-02 · 대상: 현재 브랜치(`dev`) 전체 코드베이스
> 방법: 멀티에이전트(34 agents) 6개 보안 차원 병렬 검토 → 발견별 적대적 검증(false positive 필터) → 종합
> 결과: 검증 통과 16건 / 기각(FP) 11건 → 동일 원인 병합 후 **11건** 제시

## 1. 심각도별 요약

| 심각도 | 건수 | 비고 |
|--------|------|------|
| Critical | 0 | — |
| High | 1 | detect-roof 과금/DoS |
| Medium | 3 | XFF rate-limit 우회(병합), 인증 부재 |
| Low | 7 | 정보노출·컨테이너 하드닝·헤더 |
| Info | 0 | — |
| **합계** | **11** | (검증 통과 16건 중 동일 원인 4건·2건을 각각 1건으로 병합) |

**총평**: 본 애플리케이션은 인증·인가 계층이 전혀 없는 공개 SPA + BFF 구조이며, 보안 통제가 사실상 `proxy.ts`의 Origin 검증과 per-IP rate-limit 단 두 가지에 의존한다. 그런데 (a) 가장 비용이 큰 `/api/detect-roof`(Gemini Vision 2회 호출)는 그 두 통제의 적용 대상(matcher)에서조차 누락되어 있고, (b) rate-limit 자체가 클라이언트가 위조 가능한 `x-forwarded-for`를 무검증 신뢰해 우회된다. 즉 유일한 방어선에 구조적 공백과 우회 경로가 동시에 존재한다. 다만 데이터 유출·권한 상승·RCE로 직결되는 취약점은 없고, 영향은 대부분 **비용 폭증·가용성(DoS)·정보 노출** 수준에 한정된다. 나머지 발견은 정보 노출(에러 메시지·passthrough)과 컨테이너/헤더 하드닝 누락으로, 즉시 악용보다는 위생·심층 방어 차원의 개선 항목이다.

---

## 2. 핵심 권고 Top 3

1. **`/api/detect-roof`를 proxy matcher에 즉시 포함** — 가장 비싼 외부 LLM 과금 엔드포인트가 Origin 검증·rate-limit 어디에도 걸리지 않는다. matcher에 추가하고, detect 전용으로 더 낮은 한도(예: 분당 5~10회)를 둔다. (발견 #1, High)
2. **rate-limit IP 산출의 신뢰 경계 확립** — `x-forwarded-for` 첫 토큰 무검증 신뢰를 제거한다. 앞단에 XFF를 강제 재작성하는 신뢰 프록시를 두고 코드는 신뢰 hop만 채택하거나, IP 대신 토큰/세션 기반 제한으로 전환한다. (발견 #2, Medium)
3. **BFF/detect 공개 노출 정책 확정 + 최소 인증 도입** — Origin 검증은 CSRF 완화일 뿐 인가가 아니다. 공개가 의도가 아니라면 세션/서명 토큰을 도입하고, 공개가 불가피하면 응답 필드 화이트리스트와 엔드포인트별 한도 강화로 노출면을 줄인다. (발견 #3, Medium)

> Top 1·2는 아래 "공격 체인"에서 결합되어 위험이 증폭되므로 함께 처리하는 것이 효과적이다.

---

## 3. 공격 체인 — XFF 스푸핑 → rate-limit 우회 → detect-roof 과금 폭탄 / 업스트림 남용

개별 발견이 결합되면 영향이 증폭된다.

```
[A] x-forwarded-for 무검증 신뢰        (발견 #2, proxy.ts:17-26)
        │  매 요청 XFF 랜덤화 → 매번 새 rate-limit 키
        ▼
[B] per-IP rate-limit 무력화           (발견 #2)
        │  분당 30회 sliding-window가 항상 빈 윈도우로 평가
        ├──────────────┬──────────────────────────────┐
        ▼              ▼                              ▼
[C1] /api/qsp,        [C2] detect-roof 는 애초에       [C3] MAX_TRACKED_IPS(10,000)
     /api/musbi 로         matcher에서 누락             LRU에 위조 IP 대량 주입 →
     무제한 중계            (발견 #1·#3) → rate-limit     정상 IP 엔트리 축출
     (업스트림 비용/        보호가 [B] 없이도 0           (rate-limit 일관성 붕괴)
      쿼터 고갈)            → Gemini 2회 호출 반복
                          → GEMINI_API_KEY 과금 폭증
                            + sharp 디코드 CPU 고갈(DoS)
```

핵심: `detect-roof`(발견 #1·#3)는 **체인 없이도 단독으로** rate-limit 보호가 0이므로 가장 먼저 막아야 하고, QSP/MUSBI 경로(발견 #2·#6·#7)는 XFF 스푸핑으로 rate-limit이 우회되어야 무제한 남용이 성립한다. 두 경로 모두 인증 부재(발견 #3)라는 공통 토대 위에 있다. 인증을 도입하면 체인 전체가 차단되고, matcher 보강 + XFF 신뢰 경계는 인증 없이도 즉시 적용 가능한 완화책이다.

---

## 4. 발견 상세 (심각도순)

### [High] #1 — detect-roof, rate-limit/인증 부재로 Gemini 과금 폭탄·DoS

- **파일/라인**: `src/app/api/detect-roof/route.ts:345-404` (누락 원인: `src/proxy.ts:8` matcher)
- **영향**: 인증·Origin·rate-limit 어느 것도 적용되지 않는 공개 POST 엔드포인트. 요청마다 Gemini Vision을 최대 2회(locateBbox + tracePolygon, `tracePolygon`은 `maxOutputTokens=32768`/`thinkingBudget=4096`로 호출당 고비용) 호출하고, 최대 ~5MB data URL을 25M 픽셀까지 sharp로 디코드한다.
- **공격 시나리오**: 합법적 PNG data URL을 만들어 `POST /api/detect-roof`를 단일 curl 루프로 초당 수십~수백 건 반복 → Gemini 과금 폭증 + sharp 디코딩이 단일 인스턴스 CPU/메모리를 점유해 정상 사용자에게 서비스 거부. bbox 신뢰도<0.2 게이팅은 1단계(locateBbox) 과금을 막지 못하고, 실제 건물 이미지를 보내면 2단계 모두 트리거된다.
- **완화 요소(과대평가 방지)**: 단일 요청 크기 제한(`arrayBuffer().byteLength` 검증)과 upstream 429 클램핑은 존재하나 **둘 다 호출 빈도를 제한하지 않으므로** 비용 폭탄/DoS를 막지 못한다. 데이터 유출/RCE는 아님 — 영향은 비용·가용성에 한정.
- **권장 수정**: `proxy.ts` matcher에 `/api/detect-roof` 추가 → Origin 검증 + rate-limit 적용. detect 전용으로 더 엄격한 한도(분당 5~10회). 가능하면 인증 토큰/세션 게이팅 추가. 스케일아웃 시 in-memory가 아닌 분산 rate-limit(Redis 등)으로 교체.

---

### [Medium] #2 — rate-limit이 x-forwarded-for 첫 값을 무검증 신뢰 → 한도 우회·타 IP 고갈 *(중복 4건 병합)*

> **병합 고지**: 동일 파일·동일 원인(`src/proxy.ts:17-26` `clientIp()`의 XFF 무검증 신뢰)을 지목한 4개 발견(dimension: ssrf-proxy / input-injection ×2 / infoleak-authz / deps-infra)을 하나로 병합했다. 4건 모두 검증가 판정 isReal=true, adjustedSeverity=Medium으로 일관되며, 본문·시나리오·권고가 실질적으로 동일하다. (보조 논점인 "Origin 부재 GET 통과"는 별도 발견 #4로 분리 유지.)

- **파일/라인**: `src/proxy.ts:17-26` (사용처: `:81` `checkRateLimit(clientIp(req))`)
- **영향**: `clientIp()`가 `x-forwarded-for` 첫 토큰(없으면 `x-real-ip`)을 검증·신뢰경계 없이 rate-limit 키로 사용한다. 배포 구성(docker-compose는 컨테이너 :3000을 호스트 4000/4001/4010에 **직접 포트 매핑**, 리포 내 XFF를 재작성하는 nginx/LB 설정 부재)상 외부 클라이언트가 XFF를 임의 지정할 수 있다. → (1) 매 요청 위조 IP로 분당 30회 한도 무력화, (2) 피해자 IP로 30회를 채워 그 IP 정상 요청 429 차단(가용성 고갈), (3) 위조 IP 대량 주입으로 `MAX_TRACKED_IPS=10,000` LRU 축출.
- **공격 시나리오**: `for i in …; do curl -H 'X-Forwarded-For: 10.0.0.$RANDOM' -H 'Origin: https://<app-origin>' 'https://<app>/api/qsp/btc-items?schItemTp=M'; done` — 각 요청이 다른 키로 집계되어 한도 우회, 업스트림 QSP/MUSBI로 무제한 중계 → 쿼터/비용 고갈 또는 DoS. Origin 검증은 비브라우저 요청자가 Origin을 app-origin으로 위조하거나 GET에서 생략(safe-method 통과)할 수 있어 XFF 우회 경로를 차단하지 못한다.
- **완화 요소(과대평가 방지)**: 영향은 인증 우회·데이터 유출이 아니라 **DoS/쿼터 고갈**에 한정. rate-limit은 단일 인스턴스 in-memory best-effort 보조 방어로 문서화돼 있고, 업스트림 API 자체 인증/쿼터가 최종 방어선일 가능성이 높다. "신뢰 프록시 없으면 XFF spoofable"은 잘 알려진 한계이므로 High가 아닌 Medium이 적정.
- **권장 수정**: (1) 앞단 프록시가 XFF를 항상 덮어쓰도록 배포 보장 + 코드는 가장 오른쪽(프록시 추가) 신뢰 hop 사용 또는 알려진 프록시 IP 목록 대조. (2) XFF 신뢰 불가 환경에서는 소켓 peer 사용 또는 토큰/세션 기반 제한. (3) `'unknown'` 폴백이 미식별 트래픽을 단일 버킷으로 묶어 공유 고갈시키는 점 보정. (4) 스케일아웃 시 Redis 등 분산 저장소로 교체.

---

### [Medium] #3 — 모든 BFF/detect 엔드포인트에 인증·인가 계층 전무

- **파일/라인**: `src/app/api/qsp/btc-items/route.ts:13-27` (동일 패턴: `musbi/sim-check`·`musbi/sim-calc`·`detect-roof` POST 핸들러, `src/proxy.ts:66-91`)
- **영향**: btc-items(GET)·sim-check(POST)·sim-calc(POST)·detect-roof(POST) 어디에도 인증/세션/API 키 검사가 없다. `proxy.ts`는 Origin 검증 + rate-limit만 수행하고 신원을 확인하지 않는다. Origin 검증은 `blocked = origin ? origin !== expected : !isSafeMethod` 로직상 (a) Origin 헤더 없는 GET/HEAD는 통과, (b) POST도 `Origin: <site-origin>` 위조로 통과 — 즉 CSRF 완화일 뿐 인가 수단이 아니다. 결과적으로 QSP 마스터데이터 조회와 MUSBI 시뮬레이션 중계가 사실상 공개 API로 동작한다.
- **공격 시나리오**: `curl -H 'Origin: https://<배포도메인>' -X POST <배포도메인>/api/musbi/sim-calc -d '<유효 페이로드>'` → 인증 없이 MUSBI 업스트림 시뮬레이션 호출. btc-items는 Origin 없는 단순 GET으로도 통과해 QSP 자재 마스터(제품 식별자/규격)를 무인증 대량 수집.
- **완화 요소/맥락**: detect-roof는 matcher(`/api/qsp/*`, `/api/musbi/*`)에 포함되지 않아 Origin·rate-limit조차 받지 않으므로 **오히려 더 무방비**(발견 #1과 연결). 노출 데이터는 PII/시크릿이 아닌 카탈로그성 마스터데이터에 가까움.
- **권장 수정**: 공개 노출이 의도된 제품 요구사항인지 먼저 확정. 의도가 아니면 BFF 라우트에 최소 인증(세션/서명 토큰) 도입. 공개가 불가피하면 Origin 검증을 인가로 오인하지 말고, 엔드포인트별 rate-limit 강화 + 응답 필드 화이트리스트로 노출면 축소.

---

### [Low] #4 — Origin 부재 시 GET/HEAD 무조건 통과 → 비브라우저 직접 호출로 Origin 검증 우회

- **파일/라인**: `src/proxy.ts:70-79`
- **영향**: `blocked = origin ? origin !== expected : !isSafeMethod` — Origin 헤더가 없으면 GET/HEAD는 항상 통과한다. 브라우저 same-origin safe-method가 Origin을 안 붙인다는 전제에 기댄 설계지만, curl/스크립트/봇은 Origin을 생략한 GET을 자유롭게 보낼 수 있다. → `/api/qsp/btc-items`(GET) 같은 읽기 BFF의 Origin 검증이 무의미해지고 외부 클라이언트가 업스트림 QSP 마스터데이터 중계를 호출. state-changing POST(sim-check/sim-calc)는 Origin 필수라 이 경로는 차단됨.
- **공격 시나리오**: `curl 'https://<app>/api/qsp/btc-items?schItemTp=M'`(Origin 없음) → origin=null, isSafeMethod=true → blocked=false 통과 → `fetchBtcItems`가 QSP 모듈/배터리 마스터데이터(제품ID·치수)를 envelope로 반환. 인증 부재와 결합 시 누구나 열람/대량 수집.
- **완화 요소(과대평가 방지)**: 노출 대상은 PII/시크릿이 아닌 제품 카탈로그성 마스터데이터(준공개 성격). per-IP rate-limit이 대량 스크래핑을 부분 억제(분산 IP/단일 인스턴스 한계 존재). state 변경 불가. → 원래 Medium은 과대평가이며 **Low로 하향**.
- **권장 수정**: Origin/CSRF 검증과 호출 권한을 분리. GET BFF 공개 여부 정책 명시. 비공개라면 Sec-Fetch-Site/Sec-Fetch-Mode 등 fetch metadata 검증 또는 최소 인증 토큰 도입. Origin 부재 GET 통과를 유지하더라도 응답 필드 최소화 또는 인가 추가.

---

### [Low] #5 — sim-calc 업스트림 응답 passthrough → 미정 필드 과다 노출

- **파일/라인**: `src/lib/qsp/client.ts:214-225` (`SimCalcResponseSchema` `.passthrough()` @ `schema.ts:98-110`, 반환: `sim-calc/route.ts:30` `envelopeSuccess(result.data)`)
- **영향**: `postSimCalc`는 `SimCalcResponseSchema(.passthrough())`로 검증 후 업스트림(MUSBI) 응답 전체를 클라이언트에 그대로 반환한다. passthrough이므로 스키마 미정의 임의 필드가 모두 클라이언트로 흘러간다. 응답 사양이 "미정"인 현 상태에서 업스트림이 내부 식별자·진단·에러 디테일을 포함하면 BFF가 무필터 노출. 대조군: `btc-items`는 `result.data.data`만 추출·필드 제한, `sim-check`는 `data:null`로 본문 폐기 → 동일 문제는 sim-calc에만 존재.
- **공격 시나리오**: 정상 폼 입력으로 `POST /api/musbi/sim-calc` 호출 시 업스트림이 사양 외 부가 필드(내부 트랜잭션ID·디버그 메시지·내부 경로)를 반환하면 passthrough로 envelope.data에 실려 브라우저로 전달 → 정상 요청만으로 업스트림 내부 구조/식별자 점진 수집.
- **완화 요소(과대평가 방지)**: 실제 민감 데이터 노출 여부는 "업스트림이 사양 외 민감 필드를 반환한다"는 **미확인 가정**에 의존하는 조건부 위험. 노출 대상은 호출자 자신의 요청 결과 본문(타 사용자 데이터 아님). → Low 적정.
- **권장 수정**: 응답 사양 확정 시 `.passthrough()` 제거 + 클라이언트 필요 필드만 명시한 strict 스키마로 화이트리스트 변환. 확정 전까지 알려진 진단/내부 키 strip 또는 필요한 결과 필드만 골라 매핑.

---

### [Low] #6 — 업스트림(QSP/MUSBI) 에러 메시지 원문이 클라이언트로 그대로 노출

- **파일/라인**: `src/lib/qsp/client.ts:169-178` (`extractUpstreamStatus` @ `:60-76`; 전달: `btc-items/route.ts:24`, `sim-calc/route.ts:28`, `sim-check/route.ts:28`)
- **영향**: `callQsp`가 업스트림 응답의 `message`/`resultMessage`를 추출해 실패 결과 `message`로 반환하고, 라우트들이 `envelopeError(status, code, message)`로 무가공 전달한다. 외부 QSP/MUSBI가 반환하는 내부 검증 오류 문구·내부 코드·DB/엔티티 명칭이 그대로 최종 사용자에게 흘러갈 수 있다. detect-roof의 `respondWithUpstreamError`(`route.ts:410-421`)가 generic 메시지로 마스킹하는 것과 대조적으로 QSP/MUSBI 경로엔 마스킹이 없다.
- **공격 시나리오**: 업스트림 검증을 의도적으로 실패시키는 입력(예: 존재하지 않는 moduleItemId)을 보내면 upstream `resultMessage`(내부 컬럼명/스택성 메시지/내부 식별자 포함 가능)가 응답 message로 노출 → 내부 데이터 모델·업스트림 구현 세부를 점진 수집.
- **완화 요소(과대평가 방지)**: 노출 문자열은 upstream이 클라이언트 소비를 전제로 반환하는 비즈니스 검증 문구이지 스택트레이스/인프라 시크릿이 아니다. DB 컬럼명·내부 식별자 포함 여부는 upstream 구현에 달린 추정이고, 2차 피해로 직결되지 않음. → 원래 Medium은 과대평가, **Low 적정**.
- **권장 수정**: QSP/MUSBI 경로도 detect-roof처럼 클라이언트에는 generic 고정 메시지만 반환하고 원문은 서버 로그에만 남긴다. `extractUpstreamStatus`의 message를 그대로 노출하지 말고 code 기반 사전 정의 메시지 매핑으로 치환.

---

### [Low] #7 — .dockerignore가 .env.dev/.env.prod 미제외 → 로컬 docker build 시 시크릿이 builder 레이어에 유입 *(Dockerfile COPY 발견과 동일 원인, 병합)*

> **병합 고지**: `.dockerignore`(분류 누락)와 `Dockerfile:16 COPY . .`(레이어 유입)를 각각 지목한 두 발견은 **동일 위생 결함의 양면**(원인=.dockerignore 패턴, 결과=COPY로 builder 레이어 잔존)이므로 하나로 병합한다. 둘 다 isReal=true, Low.

- **파일/라인**: `.dockerignore:1-7` (결과: `Dockerfile:16` `COPY . .` builder 스테이지)
- **영향**: `.dockerignore`는 `.env .env.local .env*.local`만 제외한다. `.env`는 정확 매칭이라 `.env.dev`를 커버하지 못하고, `.env*.local`은 `.local` 종료 파일만 매칭 → `.env.dev`/`.env.prod`가 어떤 패턴에도 안 걸린다. builder 스테이지 `COPY . .`가 이를 builder 레이어로 복사한다. **노출 대상 정밀화**: 실제 크리덴셜(GEMINI_API_KEY/AWS_*/NEXT_PUBLIC_*)은 정확 매칭으로 제외되는 `.env`에만 존재하므로 이미지에 들어가지 않는다. `.env.dev`/`.env.prod`에 담기는 것은 `QSP_API_HOST`/`MUSBI_API_HOST`(공인 도메인 호스트명) + `ENABLE_API_DOCS` 플래그뿐이다.
- **공격 시나리오**: 개발자가 `.env.prod`를 보유한 채 로컬에서 `docker compose --profile prod build` 실행 → `COPY . .`로 `.env.prod`가 builder 레이어 복사. 이 머신이 빌드 캐시를 공유 레지스트리에 push하거나 builder 단계 이미지를 export하면 `docker history`/레이어 tar 추출로 평문 노출(공인 외부 API 호스트명 핑거프린팅 수준).
- **완화 요소(과대평가 방지)**: (a) runner 스테이지(`Dockerfile:34-36`)는 `.next/standalone` 등만 COPY → final 배포 이미지엔 미포함(multi-stage 1차 방어). (b) CI(Jenkins)는 `.env`만 생성 → 운영 산출물 경로에선 미노출. (c) 진짜 시크릿은 보호되고 노출 값은 공인 도메인+플래그뿐. → Medium은 과대평가, **Low 적정**.
- **권장 수정**: `.dockerignore`의 `.env`를 `.env*`로 변경하거나 `.env.dev`·`.env.prod`를 명시 추가해 모든 환경파일을 빌드 컨텍스트에서 배제. (NEXT_PUBLIC_* 값은 docker-compose `build.args`로 주입되므로 env 파일을 컨텍스트에 둘 이유 없음.) 또는 `COPY . .` 대신 빌드 필요 경로만 명시 복사.

---

### [Low] #8 — Docker 베이스 이미지 다이제스트 미고정 (node:20-alpine 무버전 태그)

- **파일/라인**: `Dockerfile:1, 26` (+ `:4` `corepack prepare pnpm@10`)
- **영향**: base/runner 스테이지 모두 `FROM node:20-alpine`로 가변 태그 사용. 다이제스트 핀(`@sha256:…`) 부재로 빌드 시점마다 다른 패치 이미지가 당겨질 수 있어 재현성·공급망 무결성 미보장. `corepack prepare pnpm@10`도 가변 메이저로 동일한 부동성.
- **공격 시나리오**: `node:20-alpine` 태그 대상 업스트림 이미지가 손상/변조(레지스트리 침해·태그 재할당)되거나 회귀 패치 시점에 CI가 빌드하면 검증되지 않은 베이스가 프로덕션 산출물에 편입. 다이제스트 고정 없이는 빌드 단계에서 변조 탐지 불가.
- **완화 요소(과대평가 방지)**: 직접 익스플로잇 가능한 코드 취약점이 아닌 공급망 모범 사례 위반. 시나리오가 Docker Hub 공식 `node` 레지스트리 침해라는 외부 신뢰 경계 가정에 의존. npm 의존성은 `Dockerfile:10 pnpm install --frozen-lockfile`로 lockfile 고정되어 OS 베이스 레이어만 부동. → Low 적정.
- **권장 수정**: `FROM node:20-alpine@sha256:<pinned-digest>` 형태로 다이제스트 고정 후 Renovate/Dependabot 주기 갱신. `corepack prepare`도 `pnpm@10.x.y` 패치까지 고정.

---

### [Low] #9 — 컨테이너 런타임 권한 하드닝 부재 (no-new-privileges/cap_drop/read_only 미적용)

- **파일/라인**: `docker-compose.yml:1-49`
- **영향**: 세 서비스(app-dev/app-prod-4000/app-prod-4001) 어디에도 `security_opt: no-new-privileges:true`, `cap_drop: [ALL]`, `read_only:true`, tmpfs 설정이 없다. `Dockerfile:38 USER nextjs`로 비루트 실행은 적용되어 기본 탈출 위험은 낮으나, 권한 상승 차단·불필요 capability 제거·루트FS 읽기전용 같은 심층 방어가 빠짐. HEALTHCHECK 미정의로 `restart: unless-stopped`에만 의존.
- **공격 시나리오**: detect-roof의 sharp 이미지 파싱이나 의존성 RCE류 **1차 취약점이 먼저 트리거**되어 임의 코드 실행에 이르면, no-new-privileges 부재로 setuid 권한 상승 시도가 차단되지 않고 cap_drop 부재로 불필요한 capability가 공격자에게 가용해 행위 반경이 넓어진다.
- **완화 요소(과대평가 방지)**: 단독 악용 가능 취약점이 아닌 심층 방어 누락 — 시나리오가 선행 취약점 존재를 전제. 핵심 1차 방어선인 비루트 실행은 이미 적용(USER nextjs). 단, sharp가 사용자 제공 위성 이미지를 파싱하는 실제 공격면이 있어 Info까지 낮추지 않고 Low 유지.
- **권장 수정**: 각 서비스에 `security_opt: ["no-new-privileges:true"]`, `cap_drop: ["ALL"]`, `read_only: true`(+쓰기 필요 경로는 tmpfs)와 HEALTHCHECK 추가. standalone 서버는 추가 capability가 거의 불필요.

---

### [Low] #10 — Docker 호스트 포트 다중 노출(0.0.0.0 바인딩) 및 prod 서비스 중복 공개

- **파일/라인**: `docker-compose.yml:11-12, 28-29, 42-43`
- **영향**: ports 매핑이 `"4010:3000"`, `"4000:3000"`, `"4001:3000"`로 호스트 IP 한정 없이 선언되어 기본 0.0.0.0(모든 인터페이스)에 바인딩된다. prod 프로파일은 4000/4001 두 인스턴스를 모두 공개해 동일 앱이 두 포트로 직접 외부 노출. 인증 없는 공개 BFF 프록시와 결합되면 정상 리버스 프록시 경유가 아닌 컨테이너 포트 직접 접근 경로가 늘어난다.
- **공격 시나리오**: 방화벽이 4000만 막고 4001/4010을 누락하는 설정 불일치가 생기면, 외부 공격자가 직접 컨테이너 포트로 `/api/musbi/sim-calc` 등을 호출해 **XFF 위조 rate-limit 우회(발견 #2)와 결합**한 업스트림 남용 수행. 다중 포트는 방화벽 관리 실수 표면을 키운다.
- **완화 요소(과대평가 방지)**: 코드 결함이 아닌 배포 하드닝 사안. 실제 외부 도달 여부는 호스트 방화벽/보안그룹에 전적 의존. 시나리오가 "방화벽 오설정"이라는 가정적 트리거 요구 → 단독 직접 피해 없음. → Low 적정.
- **권장 수정**: 외부 노출은 단일 리버스 프록시(TLS 종단)만 두고, 앱 컨테이너 포트는 `"127.0.0.1:4000:3000"`처럼 루프백/내부 네트워크에만 바인딩. 이중 인스턴스가 LB용이면 `expose`(내부 전용)로 전환하고 ports 직노출 제거.

---

### [Low] #11 — 보안 응답 헤더 전무 (next.config.ts에 CSP/HSTS/X-Frame-Options 등 미설정)

- **파일/라인**: `next.config.ts:3-6`
- **영향**: `next.config.ts`에는 `output:"standalone"`과 `reactCompiler:true`만 있고 `headers()` 함수가 없다. 저장소 전체에서 CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy 설정 0건. standalone 서버는 기본적으로 이들을 붙이지 않고, 헤더를 보강할 리버스 프록시 계층도 부재 → 모든 HTML/JSON 응답이 보안 헤더 없이 노출.
- **공격 시나리오**: (1) 클릭재킹 — X-Frame-Options/CSP frame-ancestors 부재로 iframe 오버레이 UI redress. (2) MIME 스니핑 — nosniff 부재. (3) HTTPS 다운그레이드 — HSTS 부재.
- **완화 요소(과대평가 방지)**: 실제 영향이 약함. (1) 인증/세션/상태 변경 권한이 없는 공개 SPA라 클릭재킹으로 victim을 속여도 state-changing authenticated action이 없어 공격자 이득이 없음. (2) same-origin에서 공격자 제어 HTML을 브라우저가 해석하는 경로가 없어 nosniff 부재만으로 XSS 미성립. (3) `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`는 어차피 번들에 인라인된 공개 브라우저 키(도메인/referrer 제한으로 방어하는 것이 정석)라 평문 탈취가 새 시크릿 노출 아님. 현재 compose에 TLS 종단 계층 자체가 없어 HSTS 적용 맥락도 불완전. → 원래 High는 과대평가, **Low(정보성에 가까움)**.
- **권장 수정**: `next.config.ts`에 `async headers()` 추가 — 전 경로에 `X-Frame-Options:DENY`(또는 CSP `frame-ancestors 'none'`), `X-Content-Type-Options:nosniff`, `Referrer-Policy:strict-origin-when-cross-origin`, (TLS 종단 도입 시) `Strict-Transport-Security`, 그리고 Google Maps/genai 도메인만 허용하는 최소 권한 CSP(script-src에 Maps CDN, connect-src에 maps.googleapis.com).

---

## 부록 — 병합/조정 요약

- **#2 (XFF rate-limit 우회)**: 원본 4건(ssrf-proxy / input-injection×2 / infoleak-authz 차원에서 각각 보고)을 동일 원인(`proxy.ts:17-26`)으로 1건 병합. 모두 Medium·isReal=true로 일관.
- **#7 (.dockerignore + Dockerfile COPY)**: 동일 위생 결함의 원인/결과 양면 2건을 1건 병합. 노출 대상은 시크릿이 아닌 공인 호스트명+플래그로 정밀화.
- **심각도 하향(검증가 reasoning 반영)**: #4 Medium→Low, #6 Medium→Low, #7 Medium→Low, #11 High→Low. 모두 "데이터 유출/RCE/권한 상승 미해당, 영향이 비용·가용성·준공개 정보 노출에 한정"이라는 검증가 근거와 일치.

## 부록 — 검증 신뢰도 노트

- **기각(false positive) 11건**: 검증 단계에서 "실제 코드 경로 재현 불가 / 이미 완화됨 / 잘못된 전제"로 걸러낸 후보. 예: 발견 #1의 한 보고가 언급한 "S3 업로드 경로"는 detect-roof 실제 코드에 존재하지 않아 검증가가 부수 오류로 지적하고 핵심 주장(rate-limit 부재)만 채택.
- 모든 확정 발견은 검증가가 file:line을 직접 대조한 근거를 보유.
