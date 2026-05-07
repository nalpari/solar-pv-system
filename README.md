# Solar PV Planner

건물 옥상에 태양광 모듈 배치를 설계하고 발전 시뮬레이션 입력을 받는 웹 애플리케이션입니다. Google Maps 위성 이미지에서 대상 영역을 크롭하고, 크롭 팝업의 캔버스 에디터에서 지붕 면과 개구부를 그리면 자동으로 최적 배치를 계산합니다. 일본어/영어 인터페이스를 지원합니다.

## 주요 기능

- **주소 검색** — Google Places Autocomplete로 건물 위치 탐색
- **위성 지도** — 위성/일반 보기 토글, 줌 컨트롤, 중심 복귀 버튼
- **건물 확정 (Crop)** — 지도 위에서 드래그해 대상 영역을 캡처(`html2canvas`) → 크롭 팝업 진입
- **지붕 편집 툴바** — 크롭 이미지 위에서 폴리곤 편집
  - `select` 선택/이동, `drawRoof` 지붕면, `drawOpening` 개구부(제외 영역), `flowSetting` 처마(흐름방향), `editRoof` 꼭짓점 편집, `deleteSelected`, `deleteAll`, `undo`
- **모듈 선택** — 60셀 / 72셀 / 대형 / 커스텀 프리셋 (mm 단위)
- **자동 모듈 배치** — Portrait/Landscape 두 방향을 모두 시도해 더 많이 배치되는 쪽을 자동 채택
- **처마 평행 배치** — `flowSetting`으로 지정한 처마 변(eave)에 평행하도록 그리드 정렬
- **결과 표시** — 총 패널 수, 설치 용량, 패널 면적, 커버리지 비율
- **이미지 저장** — 크롭 팝업에서 폴리곤 + 패널 오버레이가 합성된 PNG 다운로드
- **발전 시뮬레이션 입력** — 방위, 배터리(유/무·모델), 월 평균 전기요금 입력 화면
- **다국어** — 일본어(기본) / 영어 토글, `<html lang>` 속성 자동 동기화

## 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.2.0 | App Router, `output: "standalone"`, React Compiler 활성화 |
| React | 19.2.4 | React Compiler |
| TypeScript | ^5 | strict mode |
| Tailwind CSS | v4 | `@tailwindcss/postcss` (CSS 커스텀 프로퍼티 기반) |
| @vis.gl/react-google-maps | ^1.7.1 | Google Maps 통합 |
| html2canvas | ^1.4.1 | 지도 영역 캡처 / PNG 저장 |
| lucide-react | ^0.577.0 | 아이콘 |
| babel-plugin-react-compiler | 1.0.0 | React Compiler |
| ESLint | ^9 | flat config (`eslint-config-next`) |

## 시작하기

### 사전 요구사항

- Node.js 20+
- pnpm
- Google Maps API 키 (Maps JavaScript API, Places API, Geometry API 활성화 필요)

### 설치 및 실행

```bash
pnpm install
```

`.env.local` 파일에 Google Maps API 키를 설정합니다:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

개발 서버 실행:

```bash
pnpm dev
```

[http://localhost:3000](http://localhost:3000)에서 확인합니다.

### 빌드 / 실행 / 검증

```bash
pnpm build      # next build (standalone output)
pnpm start      # 프로덕션 서버
pnpm lint       # ESLint
npx tsc --noEmit  # 타입 체크
```

### Docker 배포

`.env` 파일에 API 키를 설정한 후:

```bash
docker compose up --build       # 빌드 및 실행
docker compose up --build -d    # 백그라운드
docker compose down             # 중지
```

단독 빌드:

```bash
docker build --build-arg NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here -t solar-pv-system .
docker run -p 3000:3000 solar-pv-system
```

## 아키텍처

좌측 사이드바(설계/시뮬레이션 탭)와 우측 Google Maps 메인 영역으로 구성된 SPA입니다. 크롭 후에는 메인 영역 위에 `CropPopup`(폴리곤 편집/패널 배치 캔버스)이 오버레이됩니다.

### 프로젝트 구조

```
src/app/
├── components/
│   ├── AddressSearch.tsx      # Places Autocomplete 주소 검색
│   ├── CropPopup.tsx          # 크롭 이미지 위 캔버스 폴리곤 에디터 + 패널 렌더링 + PNG 저장
│   ├── Header.tsx             # 사이드바 상단 헤더
│   ├── MapView.tsx            # Google Maps + 크롭 영역 선택 오버레이 (html2canvas 캡처)
│   ├── PanelConfig.tsx        # 모듈 프리셋 / 폭·높이(mm) 입력
│   ├── ResultsPanel.tsx       # 배치 결과 통계 + 모듈 배치/삭제 액션
│   ├── RoofEditToolbar.tsx    # 지붕 편집 툴바 (지도 위 플로팅)
│   └── SimulationPanel.tsx    # 발전 시뮬레이션 입력 폼
├── utils/
│   ├── i18n.ts                # 일/영 번역 사전 + `t(key, lang)` 함수
│   └── panelPlacement.ts      # 좌표 변환 및 패널 배치 계산 엔진
├── types/index.ts             # 도메인 타입
├── globals.css                # CSS 커스텀 프로퍼티 테마
├── layout.tsx                 # 루트 레이아웃 (Server Component)
└── page.tsx                   # 메인 페이지 (Client Component, 전역 상태 소유)
```

### 상태 관리

`page.tsx`가 모든 상태(언어, 탭, 크롭 데이터, 폴리곤 영역, 픽셀 영역, 배치된 패널, 시뮬레이션 입력 등)를 소유하고 자식 컴포넌트에 props로 전달하는 Props-Down / Callbacks-Up 패턴을 사용합니다. `RoofEditToolbar`의 활성 도구에서 `CropPopup`의 `drawingMode`(install/exclude/null)를 파생합니다.

### 핵심 로직 — 패널 배치 알고리즘 (`utils/panelPlacement.ts`)

세 가지 진입점을 제공합니다:

| 함수 | 좌표계 | 단위 | 호출 위치 |
|------|--------|------|-----------|
| `placePanels` | lat/lng | mm | 지도 직접 배치 (크롭 미사용 경로) |
| `placePanelsOnCanvas` | 픽셀 | mm | 내부 구현 |
| `placePanelsOnCanvasCm` | 픽셀 | cm | UI 진입점 (크롭 팝업) |

공통 처리 단계:

1. **좌표 변환** — lat/lng ↔ 로컬 미터(위도 보정), 또는 픽셀 ↔ 미터(`metersPerPixel` 스케일) 변환
2. **인셋(여백)** — `MARGIN_CM`만큼 폴리곤을 내부로 축소
3. **그리드 정렬** — 처마(`eaveEdgeIndex`) 또는 폴리곤의 가장 긴 변을 기준축으로 그리드 생성
4. **유효성 검증** — 4꼭짓점이 설치 영역 내부, 제외 영역과 겹치지 않음
5. **좌표 복원** — 픽셀 결과는 캔버스 Y축 반전 처리 후 반환

`page.tsx`는 portrait/landscape 양쪽으로 호출해 더 많이 배치된 결과를 채택합니다.

### 배치 상수

`page.tsx`에 고정값으로 선언되어 있습니다 (UI 입력 아님):

| 상수 | 값 | 의미 |
|------|----|------|
| `GAP_CM` | `0.3` | 모듈 간 간격 (3 mm) |
| `MARGIN_CM` | `30` | 외주 여백 (300 mm) |

### 스타일링

`globals.css`의 CSS 커스텀 프로퍼티(`--bg-primary`, `--accent-blue`, `--radius-md` 등)를 인라인 스타일로 적용합니다. Tailwind 유틸리티 클래스는 사용하지 않습니다.

### 도메인 타입 (`src/app/types/index.ts`)

| 타입 | 설명 |
|------|------|
| `LatLng` | 위도/경도 좌표 |
| `PanelSize` | 모듈 크기 (label, width/height mm) |
| `PanelOrientation` | `"portrait"` \| `"landscape"` |
| `DrawingMode` | `"install"` \| `"exclude"` \| `null` (`RoofEditToolbar`에서 파생) |
| `PolygonArea` | lat/lng 폴리곤 (id, type, paths, `eaveEdgeIndex?`) |
| `PlacedPanel` | lat/lng로 표현된 배치 패널 (`polygonId`, 4 corners) |
| `CropBounds` | 크롭 영역의 SW/NE lat/lng |
| `CropData` | 크롭 결과 (이미지 dataURL, bounds, address, zoom, sizeMeters) |
| `PixelPoint` | 캔버스 픽셀 좌표 |
| `PixelPolygon` | 픽셀 폴리곤 (id, type, points, `eaveEdgeIndex?`) |
| `PixelPanel` | 픽셀로 표현된 배치 패널 (`polygonId`, 4 corners) |
| `PolygonSubMode` | `"idle"` \| `"selected"` \| `"moving"` \| `"editing_vertices"` |

## 사용 방법

1. 사이드바 상단의 **주소 검색**으로 대상 건물로 이동합니다.
2. **建物確定 / Confirm Building**을 누르고 지도 위에서 드래그하여 옥상이 잘 보이는 범위를 크롭합니다 → 크롭 팝업이 열립니다.
3. **屋根編集 / Edit Roof**을 활성화하여 지도 위 플로팅 툴바를 표시한 뒤:
   - `drawRoof`로 지붕면 폴리곤을 그립니다 (3점 이상 → 시작점 클릭으로 닫기)
   - `drawOpening`으로 환기구 등 개구부(제외 영역)를 그립니다
   - `flowSetting`으로 각 지붕면의 처마(흐름방향) 변을 지정하면 모듈이 그 변과 평행하게 배치됩니다
   - `editRoof`로 꼭짓점을 드래그하거나 더블클릭으로 삭제, `undo`로 직전 작업 되돌리기
4. 사이드바의 **傾斜設定 / Slope Settings**(寸 단위, 0.5 ~ 10)와 **모듈 선택**(프리셋 또는 커스텀 mm)을 설정합니다.
5. **モジュール配置 / Place Modules**를 누르면 portrait/landscape 두 방향을 모두 시도해 더 많이 들어가는 쪽이 자동 적용됩니다.
6. 결과 패널에서 총 패널 수와 설치 용량을 확인하고, 필요 시 **保存 / Save**으로 PNG를 내려받습니다.
7. **発電シミュレーション / Simulation Input** 탭에서 방위·배터리·월 평균 전기요금을 입력합니다 (결과 조회 API는 추후 연동).

## 모듈 프리셋

| 프리셋 | 폭 (mm) | 높이 (mm) |
|--------|---------|-----------|
| Standard 60-Cell | 991 | 1,650 |
| Standard 72-Cell | 991 | 1,960 |
| Large Format | 1,134 | 2,278 |
| Custom | 사용자 지정 | 사용자 지정 |

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | ✅ | Google Maps API 키 (Maps JS / Places / Geometry) |

## 추가 문서

- [`AGENTS.md`](./AGENTS.md) — AI 코딩 에이전트 공통 가이드 (구조·관례·테스트)
- [`CLAUDE.md`](./CLAUDE.md) — Claude Code 전용 설정 및 작업 메모
