# Solar PV Planner — 시스템 아키텍처

> 대상 커밋: `718d376` (2026-07-27) · 근거: `src/**`, `next.config.ts`, `package.json`, `docs/okf/`
> 도메인 규칙·계약의 진실의 원천은 [`docs/okf/`](okf/index.md) 다. 본 문서는 그 개념들을 **시스템 전체 조망** 관점에서 한 장에 펼친 것이다.
> 어긋나는 곳이 있으면 okf 가 이긴다.

---

## 1. 한눈에

| 항목 | 내용 |
|------|------|
| 성격 | 단일 페이지 웹앱 + 얇은 BFF. 서버에 상태를 두지 않는다 |
| 프레임워크 | Next.js 16.2 App Router · `output: "standalone"` · React Compiler 활성 |
| 런타임 | 전 서버 코드 `runtime = "nodejs"` |
| 서버 컴포넌트 | `src/app/layout.tsx` **하나뿐**. 나머지 UI 는 전부 `"use client"` |
| 상태 | `Home`(`page.tsx`) 단독 소유 — `useState` 30개. context / 상태 라이브러리 없음 |
| 저장소 | **없다.** 세션 상태는 브라우저 메모리에만 있고 새로고침하면 사라진다 |
| 스타일 | `globals.css` 의 CSS custom property + 인라인 스타일. Tailwind v4 는 설치만 되어 있고 유틸리티 클래스를 쓰지 않는다 |
| 시장 | 일본. `<html lang="ja">` 고정, 경사를 각도가 아닌 [寸](okf/domain/roof-slope-sun.md) 으로 입력 |
| 테스트 | 프레임워크 없음. 검증은 `pnpm lint` / `npx tsc --noEmit` / `pnpm build` |

앱이 하는 일 한 문장: **주소로 건물을 찾아 위성영상을 잘라내고, 그 위에 지붕면을 그린 뒤, 모듈이 최대 몇 장 들어가는지 계산해 외부 발전 시뮬레이션으로 넘긴다.**

---

## 2. 레이어

```
┌─ BROWSER ────────────────────────────────────────────────────────────┐
│  Home (page.tsx) — 상태 소유자                                        │
│    ├ Lnb          주소검색 · 경사 · 모듈 · 배치 / 방위 · 축전지 · 요금  │
│    ├ MapView      Google Maps 위성뷰 + 크롭 오버레이 + html2canvas    │
│    ├ CropPopup    캔버스 폴리곤 에디터 + 모듈 렌더 + 합성 PNG          │
│    └ RoofEditToolbar · AiDetectControls                              │
│  utils/  panelPlacement · mergePolygons · aiDetect · i18n · postalCode│
└──────────┬──────────────────────────────────┬────────────────────────┘
           │ 직접 호출                          │ 전부 BFF 경유
           ▼                                  ▼
┌─ GOOGLE MAPS ───────────┐   ┌─ proxy.ts (보안 경계) ───────────────────┐
│  Maps JS · Places       │   │  Origin 검증(CSRF) + per-IP rate limit  │
│  Geometry · Geocoder    │   └──────────────┬──────────────────────────┘
│  키: NEXT_PUBLIC_*      │                  ▼
│  (번들에 인라인)         │   ┌─ app/api/** + lib/** (BFF) ─────────────┐
└─────────────────────────┘   │  detect-roof · qsp/btc-items           │
                              │  musbi/sim-check · image/upload        │
                              │  openapi · /reference (조건부 노출)      │
                              └──────────────┬──────────────────────────┘
                                             ▼
                              ┌─ UPSTREAM ──────────────────────────────┐
                              │  Gemini · Replicate SAM 2               │
                              │  QSP 마스터 · MUSBI 시뮬 · AWS S3        │
                              │  자격증명은 서버에만 존재                 │
                              └─────────────────────────────────────────┘
```

**경계 규칙 하나**: 클라이언트가 직접 부르는 외부 서비스는 **Google Maps 뿐**이다. 나머지(Gemini · Replicate · QSP · MUSBI · S3)는 전부 서버 라우트가 호출하고 자격증명은 브라우저에 내려가지 않는다.

Google Maps 키만 예외인 이유는 Maps JS SDK 가 브라우저에서 동작해야 하기 때문이고, 그래서 키 보호는 코드가 아니라 **Google Cloud 콘솔의 HTTP 리퍼러 제한**에 의존한다.

---

## 3. 컴포넌트 아키텍처

### 3.1 트리

```
RootLayout                          ← 유일한 서버 컴포넌트. 폰트 3종 + metadata
└─ Home                             ← "use client", 상태 전부 소유
   └─ APIProvider                   ← @vis.gl/react-google-maps (places + geometry)
      ├─ Lnb
      │  ├─ LnbDesign               주소검색 · 경사 · 모듈 · 배치 · 용량 표시
      │  │  └─ AddressInputLnb      Places autocomplete (debounce)
      │  ├─ LnbSim                  방위 나침반 · 축전지 · 전기요금
      │  └─ Section / TipPopover
      ├─ RoofEditToolbar            그리기 · 처마 · 병합 · 되돌리기 · 삭제
      ├─ AiDetectControls           AI 분석 시작 / 취소
      ├─ MapView
      │  ├─ Map                     id: solar-pv-map
      │  ├─ ViewUpdater             viewport 있으면 fitBounds, 없으면 panTo
      │  ├─ WheelZoomController     휠 줌 기준점을 커서 → 지도 중심으로 교정
      │  └─ CropOverlay             드래그 사각형 + 8방향 리사이즈 핸들
      ├─ CropPopup                  캔버스 에디터 (폴리곤의 진실이 여기 있다)
      └─ API 키 누락 폴백
```

공용 프리미티브는 `src/components/common/` (button · checkbox · input-box · radio · select-box · toggle · tooltip) — 상태 없는 표시 전용이다.

### 3.2 상태 소유 — Props-Down / Callbacks-Up

`Home` 이 30개의 `useState` 를 혼자 들고 자식에게 props 로 내린다. 지식 그래프에서 가장 많이 연결된 노드이자 이 앱의 유일한 god node 다.

| 그룹 | 대표 상태 |
|------|-----------|
| 지도 | `center` · `viewport` · `address` · `cropMode` · `cropData` |
| 지붕면 | `areas`(lat/lng) · `pixelAreas`(픽셀) · `selectedRoofIds` · `canMergeSelected` · `canUndoPoint` |
| 배치 | `slope` · `panelSize` · `moduleId` · `placedPanelsList` · `placedPixelPanels` · `placementError` |
| 흐름 | `activeTab` · `isPlacementDone` · `isSubmitting` · `detectStatus` |
| 시뮬 | `simForm` |

파생값은 상태로 두지 않고 매 렌더 계산한다 — `installAreas` · `excludeAreas` · `drawingMode` · `panelCount` · `canPlace` · `canSubmitSim`. React Compiler 가 켜져 있어 수동 `useMemo` 를 붙이지 않는다.

### 3.3 시그널 패턴

폴리곤의 진실은 `CropPopup` 내부 캔버스 state 에 있어서 부모가 직접 조작할 수 없다. 그래서 부모는 **증가하는 숫자**를 명령으로 내려보내고 자식이 `useEffect` 로 변화를 감지한다.

```
undoSignal · clearSignal · deleteSelectedSignal · mergeSelectedSignal · confirmCropSignal
```

예외는 `getLayoutBlob()` 하나 — 반환값이 필요해 `useImperativeHandle` 을 쓴다.

### 3.4 레이스 가드

| 지점 | 가드 |
|------|------|
| geolocation | `userOverrodeRef` — 주소를 고른 뒤 늦게 도착한 위치 응답 무시 |
| AI 감지 | `abortControllerRef` — `abortControllerRef.current !== controller` 면 stale 응답 폐기 |
| 크롭 센터 이동 | `requestAnimationFrame` — 팝업이 지도를 가린 다음 프레임에 `panTo` |
| 결과조회 제출 | `isSubmitting` — 중복 클릭 차단 + 전체화면 오버레이 |

자세히 → [`okf/modules/page-orchestrator.md`](okf/modules/page-orchestrator.md)

---

## 4. 데이터 흐름

### 4.1 설계 흐름 (주 흐름)

```
① 주소 검색     Places autocomplete → getDetails → center/viewport 이동
                기본 위치: 마운트 시 geolocation 1회, 거부되면 도쿄 마루노우치

② 건물 확정     "건물확정" 1차 클릭 → 크롭모드 / 드래그 / 2차 클릭 → 확정
                html2canvas(scale ≥ 2) 캡처 → CropData → 팝업 오픈, 지도 잠금

③ 지붕면 작성   AI 자동 감지(수동 트리거) 또는 직접 그리기
                drawRoof · drawOpening · flowSetting · merge · editRoof · undo · delete

④ 경사 선택     1 · 3 · 4 · 6 · 8寸 중 하나                        (필수)
⑤ 모듈 선택     QSP 모듈 마스터에서 선택                            (필수)
⑥ 배치          정렬(aligned) 또는 치도리(staggered)
⑦ 배치 완료     편집 잠금 → 시뮬레이션 탭 활성
```

**배치 게이트(`canPlace`)**: `slope !== null && panelSize !== null && install 폴리곤 ≥ 1`.
UI 비활성화에 더해 `handlePlacePanels` 진입부에서도 다시 막는다.

**초기화 전파**는 트리거마다 지워지는 범위가 다르다 — install 면이 0개가 되면 경사·모듈만, 툴바 전체삭제는 크롭을 남기고, 크롭 팝업을 닫으면 배치잠금·시뮬 폼까지 날아간다. 표 → [`okf/workflows/design-flow.md`](okf/workflows/design-flow.md)

### 4.2 시뮬레이션 흐름 (3단계 + 이탈)

```
① 우편번호 확보   Geocoder().geocode({ location: center }) → extractPostalCode
                 ↳ 주소 검색 결과를 재사용하지 않는다. 검색 후 지도를 옮겨
                   다른 건물을 크롭할 수 있어서, 최종 크롭 중심을 다시 역지오코딩해야 한다

② 파라미터 검증   POST /api/musbi/sim-check → data.redirectUrl
                 ↳ 검증이 업로드보다 먼저다. 틀린 파라미터로 S3 에 쓸 이유가 없다

③ 이미지 업로드   CropPopup.getLayoutBlob() → POST /api/image/upload
                 ↳ 4xx 즉시중단 / 그 외 3회 지수 백오프(500ms → 1000ms)

④ 이탈           window.location.href = redirectUrl + "&roofImgSrc=" + fileName
```

성공하면 페이지를 떠나므로 로딩 오버레이를 내리지 않는다 — 중단 경로에서만 `setIsSubmitting(false)`.

자세히 → [`okf/workflows/simulation-flow.md`](okf/workflows/simulation-flow.md)

### 4.3 AI 지붕 감지 파이프라인

```
크롭 dataURL
 → ① Replicate SAM 2 combined_mask   실패·토큰없음 → null 반환하고 건너뜀 (graceful, 조용함)
 → ② Gemini Vision                   이미지 1~2장(원본 → 마스크 순서가 계약) + responseSchema 강제
 → ③ zod 검증 → 신뢰도 게이트          하나라도 0.5 미만이면 전체를 빈 배열로 차단
 → 정규화 [0..1] 폴리곤
 → ④ 클라이언트 어댑터                 캔버스 크기를 아는 시점에 픽셀 변환 + 처마를 가장 긴 변으로 자동 지정
```

신뢰도 게이트가 부분 폐기가 아니라 전체 차단인 이유: 결과가 지붕의 **분할(partition)** 이라 하나를 빼면 합집합에 구멍이 생긴다.

자세히 → [`okf/modules/ai-roof-detection.md`](okf/modules/ai-roof-detection.md)

---

## 5. 서버 레이어 (BFF)

라우트 핸들러는 얇고, 업스트림 호출·검증·정규화는 `src/lib/**` 이 맡는다.

| 엔드포인트 | 업스트림 | 하는 일 |
|-----------|---------|---------|
| `POST /api/detect-roof` | Replicate + Gemini | 크롭 이미지 → 정규화 폴리곤 |
| `GET /api/qsp/btc-items` | QSP 마스터 | 모듈(`M`) / 축전지(`B`) 목록 |
| `POST /api/musbi/sim-check` | MUSBI | 파라미터 검증 + **결과 페이지 URL 발급** (계산하지 않는다) |
| `POST /api/image/upload` | AWS S3 | 합성 레이아웃 PNG 저장 |
| `GET /api/openapi` | — | zod 스키마에서 생성한 OpenAPI 3.1 JSON |
| `GET /reference` | — | Scalar API Reference UI |

### 5.1 응답 envelope

성공 `{ success: true, data }` · 실패 `{ success: false, error: { code, message } }`.

⚠️ **예외 하나** — `detect-roof` 의 **성공** 응답만 envelope 없이 `{ polygons, reason }` 을 그대로 반환한다. 실패는 envelope 를 쓴다.

### 5.2 `callQsp` 로 수렴

QSP/MUSBI 업스트림 호출은 전부 이 함수 하나를 지난다.

```
호스트 미설정 확인 → URL+querystring 조립 → fetch(GET, no-store, 30s AbortController)
  → JSON 파싱 → zod 검증 → upstream result.code 확인 → 판별 유니온 반환
```

업스트림은 두 API 모두 **GET + querystring** 이다. BFF 가 POST/JSON 으로 받더라도 여기서 GET 으로 바꿔 부른다.

| upstream `result.code` | → HTTP | 의미 |
|---|---|---|
| 200 | 성공 | |
| 600 | 401 | 토큰 만료 |
| 400 | 422 | 검증 실패 |
| 그 외 | 502 | upstream 오류 |

전송 계층도 구분한다 — 30초 타임아웃 → **504**, fetch 실패 → 502, JSON 파싱 실패 → 502 `"Invalid upstream response"`, zod 위반 → 502 `"Upstream contract violation"`.

### 5.3 zod 스키마가 SSOT

`src/lib/**/schema.ts` 의 zod 정의가 **런타임 검증과 OpenAPI 문서의 공통 원본**이다. `src/lib/openapi.ts` 가 `createDocument({ reused: "ref" })` 로 `.meta({ id })` 붙은 스키마를 `components.schemas` 에 자동 등록한다 — **API 문서를 손으로 쓰지 않는다.**

`/api/openapi` 와 `/reference` 는 `ENABLE_API_DOCS === "true"` 인 환경에서만 노출되고 그 외에는 404 다. `NODE_ENV` 가드를 쓰지 않는 이유는 dev/prod 양쪽 다 production 빌드이기 때문.

### 5.4 공용 방어 헬퍼

| 헬퍼 | 이유 |
|------|------|
| `readJsonBodyWithLimit(req, maxBytes)` | `req.json()` 은 크기 제한이 없어 메모리/CPU 폭탄에 노출된다. arrayBuffer 로 읽어 byte cap 후 파싱 |
| `envelopeSuccess` / `envelopeError` | `proxy.ts` 와 detect-roof 까지 같은 포맷을 쓴다 |
| `formatZodError` | issue → `"path message"` |

자세히 → [`okf/interfaces/index.md`](okf/interfaces/index.md) · [`okf/modules/qsp-bff-client.md`](okf/modules/qsp-bff-client.md)

---

## 6. 보안 경계 — `proxy.ts`

Next.js 16 의 proxy 컨벤션(구 `middleware` 는 deprecated). 함수명은 `proxy`.

```
matcher: /api/qsp/:path*  ·  /api/musbi/:path*  ·  /api/detect-roof  ·  /api/image/:path*
```

`/api/openapi` 와 `/reference` 는 이 경계 **밖**이고, 대신 `ENABLE_API_DOCS` 로 노출 자체를 막는다.

**① Origin 검증 (CSRF)** — `Origin` 헤더가 있으면 `ALLOWED_ORIGIN`(쉼표 구분) 과 정확히 일치해야 한다. 헤더가 없으면 GET/HEAD 만 통과.

> ⚠️ **배포에서 `ALLOWED_ORIGIN` 은 필수다.** 미설정 시 `req.nextUrl.origin` 으로 폴백하는데, standalone 은 `0.0.0.0:3000` 에 바인드하므로 브라우저가 보내는 Origin 과 절대 일치할 수 없어 **모든 POST 가 403** 이 된다. 로컬 dev 에서만 우연히 동작하는 폴백이다.

**② per-IP rate limit** — in-memory sliding window, 60초.

| 버킷 | 대상 | 한도 |
|------|------|------|
| `bff` | qsp · musbi · image | 30 req/min |
| `detect` | detect-roof | 10 req/min |

detect 만 낮은 이유는 thinking + output 토큰 과금이 크기 때문이다. `MAX_TRACKED_IPS = 10_000` 초과 시 Map insertion order 기반 LRU 로 축출한다.

**clientIP** 는 `X-Forwarded-For` 를 **오른쪽에서** `TRUSTED_PROXY_HOPS`(=1) 번째 항목만 채택한다 — 왼쪽은 클라이언트가 위조할 수 있다.

**알려진 한계**: 카운터가 프로세스 메모리에 있어 **단일 인스턴스 전제**다. 스케일아웃하면 실효 한도가 인스턴스 수만큼 늘어난다. 그리고 애플리케이션 레벨 인증이 없다 — 이 경계는 CSRF 와 과금 폭주를 막을 뿐 인가를 대체하지 않는다.

자세히 → [`okf/system/security-perimeter.md`](okf/system/security-perimeter.md)

---

## 7. 핵심 알고리즘

### 7.1 `panelPlacement.ts` — 배치 엔진

| 진입점 | 좌표 | 단위 | 호출자 |
|--------|------|------|--------|
| `placePanels` | lat/lng | mm | `page.tsx` (크롭 없는 경로 — 현재 UI 에서 도달하기 어렵다) |
| `placePanelsOnCanvas` | 픽셀 | mm | 내부 전용 |
| `placePanelsOnCanvasCm` | 픽셀 | cm | `page.tsx` (**실제 흐름**) |

면 하나당 절차:

```
1. margin 만큼 인셋            insetPolygon(poly, +margin)  → 자기교차면 이 면 skip
2. 기준변 각도 결정             eaveEdgeIndex 또는 가장 긴 변
3. -angle 회전                 처마가 수평이 되도록
4. 개구를 -margin 확장 후 회전   같은 좌표계로 정렬
5. bbox + eaveAtTop 판정
6. 위상 스캔 10×10             가장 많이 들어가는 배치 채택
7. +angle 역회전               원좌표계로 복원
```

**고정 규칙과 상수** (`page.tsx` 하드코딩, UI 미노출):

| 규칙 | 값 |
|------|-----|
| 방향 | **landscape 고정** — 모듈 긴 변이 처마와 평행 |
| `GAP_X_CM` | 0.3 cm — 처마 **평행** 방향 |
| `GAP_Y_CM` | 3 cm — 처마 **수직** 방향, 경사 압축 대상 |
| `MARGIN_CM` | 30 cm — 외주 이격 |

**여백의 비대칭**: 설치면은 안쪽으로 인셋, 개구는 `-margin` 즉 바깥으로 확장한다. 천창 주변에도 지붕 가장자리와 같은 300mm 이격이 생긴다.

**경사 보정**: `cosθ = 10 / √(100 + 寸²)` 를 **y축에만** 곱한다(`ph`, `gapY`). x축에 곱하면 처마 방향 길이가 틀어진다.

**최대 충진 — 위상 스캔**: 처마선에 딱 붙여 시작하지 않는다. x·y 시작 위상을 각 10등분해 **100가지를 전부 시도하고 가장 많이 들어가는 배치를 채택**한다. 최다 장수를 처마 정렬보다 의도적으로 우선한 것 — 첫 행이 처마에서 조금 떨어져 보여도 버그가 아니다.

**유효 판정** 4단계: ① 4꼭짓점이 인셋 폴리곤 안 ② 모듈 변이 폴리곤 경계와 교차하지 않음(ㄷ자 지붕의 오목부 방어 — ①만으로는 못 잡는다) ③ 개구와 3방향 비충돌 ④ 개구 확장 영역 회피.

**비용**: 대략 `면 수 × 100 × 격자칸 수 × O(n)`. 큰 지붕에서 UI 가 멈출 수 있다. `page.tsx` 가 try/catch 로 `placementError` 를 표시하지만 **느린 것은 잡지 못한다.**

### 7.2 `mergePolygons.ts` — 지붕면 병합

```ts
mergeAreaPolygons(polys: PixelPoint[][]): PixelPoint[] | null
```

**설계의 핵심**: `CropPopup` 은 "지붕결합" 버튼의 **활성 여부를 판정할 때도 이 함수를 그대로 호출한다**. 판정과 실행이 하나여서 "버튼은 켜지는데 눌러도 아무 일이 없다"가 구조적으로 불가능하다.

bridge-then-union 순서:

```
0. 영면적 배제      정점이 공선인 면이 있으면 즉시 null
1. 포개짐 배제      쌍 단위로 작은 면 대비 5% 초과 겹침이면 거부
2. 필러 생성        GAP_TOL(3px) 이내 근접 + MIN_OVERLAP(10px) 이상 겹치는 변 쌍의 틈을 메움
3. union            polygon-clipping. 단일 폴리곤이 아니면 null
4. 구멍 거부        hole 이 있으면 null — 없는 지붕을 만들지 않는다
5. 톱니 단순화      준-공선 정점 제거 (SIMPLIFY_EPS 0.5px)
```

상수가 전부 **픽셀 단위**라 캔버스 해상도가 바뀌면 실질 허용 오차도 함께 바뀐다. 병합 결과는 새 폴리곤이라 `eaveEdgeIndex` 를 승계하지 않는다 — 병합 후 처마를 다시 확인해야 한다.

### 7.3 설치 용량

```
설치 용량(kW) = 배치된 모듈 수 × PanelSize.watt / 1000
```

`wpOut` 이 없거나 0 인 모듈은 **선택지에서 제외**된다 — 0 kW 오표시 방지. "모듈 목록에 있어야 할 제품이 안 보인다" 문의의 첫 번째 확인 지점이다.

---

## 8. 좌표계와 단위

세 좌표계가 돌아간다. **Y축 방향이 다르다는 것**이 이 시스템의 가장 흔한 함정이다.

| 좌표계 | 타입 | Y축 | 어디서 |
|--------|------|-----|--------|
| 지리 | `LatLng` | 북쪽이 + | 지도 · `PolygonArea` · `PlacedPanel` |
| 로컬 미터 | `Point {x,y}` | 북쪽이 + (수학 좌표계) | `panelPlacement.ts` 내부 계산 |
| 캔버스 픽셀 | `PixelPoint` | **아래가 +** | `CropPopup` 캔버스 · `PixelPolygon` · `PixelPanel` |

```
lat/lng ──(첫 정점 원점, 평면 근사)──▶ 로컬 미터 ──(metersPerPixel)──▶ 캔버스 픽셀
   METERS_PER_LAT = 111320                        CropData.sizeMeters / 캔버스 크기
   metersPerLng(lat) = 111320 · cos(lat)
```

> ⚠️ `insetPolygon` 은 CCW 판정과 내향 법선에 부호를 쓰므로 **Y-up 을 가정한다**. 픽셀 좌표를 그대로 넣으면 인셋과 확장이 뒤바뀐다 — 호출 전에 Y 를 뒤집고 결과를 다시 뒤집는다.

단위도 층마다 다르다: **UI/`page.tsx` 상수는 cm** → `PanelSize`·QSP 마스터는 **mm** → 배치 함수 내부 계산은 **m**.

자세히 → [`okf/domain/coordinate-systems.md`](okf/domain/coordinate-systems.md)

---

## 9. 외부 의존성

```
클라이언트
├ @vis.gl/react-google-maps ^1.7.1   Maps JS · Places(Autocomplete/Details) · Geometry · Geocoder
├ html2canvas ^1.4.1                 지도 컨테이너 캡처 (scale ≥ 2, 정수 배율)
├ polygon-clipping ^0.15.7           지붕면 병합 union
├ lucide-react ^0.577.0              아이콘
└ next/font/google                   Figtree · Noto Sans JP · Geist Mono

서버
├ @google/genai ^1.52                Gemini Vision (지붕 감지)
├ @aws-sdk/client-s3 ^3.1065         레이아웃 이미지 업로드
├ zod ^4.3.6                         요청·업스트림 응답 검증 (SSOT)
├ zod-openapi ^5.4.6                 zod → OpenAPI 3.1
├ @scalar/nextjs-api-reference ^0.10 /reference UI
└ fetch                              Replicate · QSP · MUSBI (전용 SDK 없음)
```

---

## 10. 설정과 배포

### 10.1 환경변수 3파일

`.env`(공통) + `.env.dev` / `.env.prod`. Jenkins 가 `cat 공통 + 프로파일 > .env` 로 병합하므로 **같은 키는 프로파일이 이긴다**.

`NEXT_PUBLIC_*` 두 개(`GOOGLE_MAPS_API_KEY`, `AWS_S3_BASE_URL`)만 **빌드타임 ARG** 다. 클라이언트 번들에 문자열로 인라인되므로 값을 바꾸려면 컨테이너 재시작이 아니라 **이미지 재빌드**가 필요하다.

⚠️ 새 키를 추가하면 Jenkinsfile `Validate Environment` 스테이지에 `: "${VAR:?...}"` 검증 라인을 반드시 같이 추가한다(전수 검증 정책). 빠뜨리면 값이 없는 채로 배포가 성공하고 런타임 500/403 으로 나타난다.

전체 키 목록 → [`okf/system/configuration.md`](okf/system/configuration.md)

### 10.2 컨테이너

```
Dockerfile (multi-stage)
├ deps     node:20-alpine · pnpm install --frozen-lockfile
├ builder  NEXT_PUBLIC_* ARG 주입 · pnpm build → .next/standalone
└ runner   node:20-alpine · non-root nextjs · PORT=3000 · server.js
```

파이프라인 스테이지·롤백 절차 → [`ci-cd-pipeline.md`](ci-cd-pipeline.md) · [`okf/system/deployment.md`](okf/system/deployment.md)

---

## 11. 타입 시스템

도메인 타입의 SSOT 는 `src/app/types/index.ts` 다.

```
CropData          imageDataUrl · bounds(CropBounds) · sizeMeters
PolygonArea       id · type("install"|"exclude") · paths(LatLng[]) · eaveEdgeIndex?
PixelPolygon      id · type · points(PixelPoint[]) · eaveEdgeIndex?
PlacedPanel       id · polygonId · corners[4] (LatLng)
PixelPanel        id · polygonId · corners[4] (PixelPoint)
PanelSize         width(mm) · height(mm) · watt
DrawingMode       "install" | "exclude" | null
RoofTool          select | drawRoof | drawOpening | flowSetting | editRoof
Lang              "ja" | "en"
```

`install` / `exclude` 한 쌍이 두 좌표계로 각각 존재하는 것이 이 타입 체계의 골격이다 — 같은 지붕면이 지도용(`PolygonArea`)과 캔버스용(`PixelPolygon`)으로 이중화되어 있다.

---

## 12. 알려진 구조적 한계

작동은 하지만 구조에서 비롯된 것들이라 코드를 읽어도 잘 드러나지 않는다.

| 한계 | 영향 | 위치 |
|------|------|------|
| rate limit 이 in-memory | 스케일아웃하면 실효 한도가 인스턴스 수만큼 증가 | [`security-perimeter`](okf/system/security-perimeter.md) |
| 크롭 캡처 실패가 **조용하다** | 회색 플레이스홀더가 그대로 흘러가 AI 감지가 항상 실패 | [`map-view`](okf/modules/map-view.md) |
| SAM 실패가 **조용하다** | `console.warn` 만 남아 계속 실패해도 사용자·운영자가 모른다 | [`ai-roof-detection`](okf/modules/ai-roof-detection.md) |
| 인셋 자기교차 시 무음 skip | 좁은 면이 배치 0장으로 조용히 사라진다 | [`panel-placement`](okf/modules/panel-placement.md) |
| 방위·경사 매핑 미스가 `0` 으로 낙하 | 검증 오류가 아니라 잘못된 값으로 계산될 수 있다 | [`simulation-flow`](okf/workflows/simulation-flow.md) |
| S3 객체 정리 로직 없음 | 결과조회 시도마다 UUID 객체가 쌓인다. 버킷 라이프사이클 필요 | [`image-upload`](okf/interfaces/image-upload.md) |
| 언어 전환 UI 미연결 | `const [lang] = useState<Lang>("ja")` 로 setter 를 버려 `"ja"` 고정. 영어 번역문은 전부 있다 | [`solar-pv-system`](okf/system/solar-pv-system.md) |
| 테스트 프레임워크 없음 | 회귀 검증이 lint / tsc / build 뿐 | — |
| 배치 계산이 메인 스레드 동기 | 큰 지붕에서 UI 프리즈. worker 이관 여지 | [`panel-placement`](okf/modules/panel-placement.md) |

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [`architecture.html`](architecture.html) | 본 문서의 도식 강화 버전 (브라우저 열람용) |
| [`okf/index.md`](okf/index.md) | OKF 지식 번들 — 도메인·계약의 진실의 원천 |
| [`sequence-diagrams.md`](sequence-diagrams.md) | App init / i18n / area calc 시퀀스 |
| [`ci-cd-pipeline.md`](ci-cd-pipeline.md) | Jenkins 파이프라인 스테이지별 상세 |
| [`security-review-2026-06-02.md`](security-review-2026-06-02.md) | 멀티에이전트 보안 코드리뷰 |
| [`investigations/2026-06-04-detect-roof-latency-analysis.md`](investigations/2026-06-04-detect-roof-latency-analysis.md) | detect-roof 지연 진단 |
