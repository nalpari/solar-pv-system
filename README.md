# Solar PV Planner

건물 옥상에 태양광 패널 배치를 설계하는 웹 애플리케이션입니다. Google Maps 위성 이미지 위에 설치 영역과 제외 영역을 그리고, 패널 크기/방향/간격을 설정하면 자동으로 최적 배치를 계산합니다.

## 주요 기능

- **주소 검색** — Google Places Autocomplete로 건물 위치 탐색 (300ms 디바운스 적용)
- **위성 지도** — 고해상도 위성/로드맵 전환 및 줌 컨트롤
- **영역 그리기** — 설치 영역(파란색)과 제외 영역(빨간색) 폴리곤 드로잉
- **폴리곤 편집** — 꼭짓점 드래그, 전체 폴리곤 이동, 실시간 경로 동기화
- **패널 배치 계산** — 크기(mm), 방향(가로/세로), 간격, 마진을 고려한 자동 배치
- **결과 표시** — 패널 수, 설치 면적, 제외 면적, 커버리지 비율 실시간 계산

## 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.1.7 | App Router 기반 프레임워크 |
| React | 19.2.3 | React Compiler 활성화 |
| TypeScript | ^5 | strict mode |
| Tailwind CSS | v4 | `@tailwindcss/postcss` 기반 |
| @vis.gl/react-google-maps | ^1.7.1 | Google Maps 통합 |
| lucide-react | ^0.577.0 | 아이콘 |
| babel-plugin-react-compiler | 1.0.0 | React Compiler |

## 시작하기

### 사전 요구사항

- Node.js 20+
- pnpm
- Google Maps API 키 (Maps JavaScript API, Places API, Drawing API, Geometry API 활성화 필요)

### 설치 및 실행

```bash
pnpm install
```

`.env.local` 파일을 생성하고 Google Maps API 키를 설정합니다:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

개발 서버 실행:

```bash
pnpm dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

### 빌드

```bash
pnpm build
pnpm start
```

### 린트

```bash
pnpm lint
```

## 아키텍처

싱글 페이지 앱(SPA) 구조로, 왼쪽 사이드바와 Google Maps 메인 영역으로 구성됩니다.

### 프로젝트 구조

```
src/app/
├── components/
│   ├── AddressSearch.tsx    # Places Autocomplete 주소 검색
│   ├── DrawingToolbar.tsx   # 드로잉 모드 전환 (설치/제외/선택)
│   ├── Header.tsx           # 상단 헤더 및 상태 표시
│   ├── MapView.tsx          # Google Maps, 폴리곤 드로잉, 패널 오버레이
│   ├── PanelConfig.tsx      # 패널 크기/방향/간격/마진 설정
│   └── ResultsPanel.tsx     # 배치 결과 통계 표시
├── utils/
│   └── panelPlacement.ts    # 좌표 변환 및 패널 배치 계산 엔진
├── types/
│   └── index.ts             # 도메인 타입 정의
├── globals.css              # CSS 커스텀 프로퍼티 테마
├── layout.tsx               # 루트 레이아웃 (Server Component)
└── page.tsx                 # 메인 페이지 (Client Component, 전체 상태 관리)
```

### 상태 관리

`page.tsx`가 모든 애플리케이션 상태를 소유하고 자식 컴포넌트에 props로 전달하는 Props-Down / Callbacks-Up 패턴을 사용합니다.

### 핵심 로직 — 패널 배치 알고리즘 (`panelPlacement.ts`)

1. **좌표 변환**: lat/lng ↔ 로컬 미터 좌표 변환 (위도 보정 포함)
2. **폴리곤 인셋**: 마진만큼 내부로 축소한 배치 가능 영역 계산
3. **그리드 정렬**: 폴리곤의 가장 긴 변에 패널 그리드를 정렬
4. **유효성 검증**: 패널 4개 꼭짓점이 설치 영역 내부에 있고, 제외 영역과 겹치지 않는지 확인
5. **좌표 복원**: 배치된 패널 좌표를 다시 lat/lng로 변환

### 스타일링

`globals.css`에 정의된 CSS 커스텀 프로퍼티(변수)를 사용하여 인라인 스타일로 적용합니다. Tailwind 유틸리티 클래스는 사용하지 않습니다.

### 도메인 타입

| 타입 | 설명 |
|------|------|
| `LatLng` | 위도/경도 좌표 |
| `PanelSize` | 패널 크기 (label, width, height mm) |
| `PanelOrientation` | `"portrait"` \| `"landscape"` |
| `DrawingMode` | `"install"` \| `"exclude"` \| `null` |
| `PolygonArea` | 설치/제외 영역 폴리곤 (id, type, paths) |
| `PlacedPanel` | 배치된 패널 (id, corners 4개) |

## 사용 방법

1. 주소를 검색하여 대상 건물로 이동합니다
2. **Install Area** 버튼을 클릭하고 옥상 위에 설치 영역 폴리곤을 그립니다
3. 필요시 **Exclude Zone** 버튼으로 장애물(옥탑, 환기구 등) 영역을 표시합니다
4. 패널 프리셋(60-Cell, 72-Cell, Large Format) 또는 커스텀 크기를 선택합니다
5. 방향(세로/가로), 간격(0~100mm), 마진(0~1000mm)을 설정합니다
6. **Place Panels** 버튼을 클릭하면 배치 결과가 지도 위에 표시됩니다
7. 결과 패널에서 총 패널 수, 커버리지 면적, 커버리지 비율을 확인합니다

## 패널 프리셋

| 프리셋 | 가로 (mm) | 세로 (mm) |
|--------|-----------|-----------|
| Standard 60-Cell | 991 | 1,650 |
| Standard 72-Cell | 991 | 1,960 |
| Large Format | 1,134 | 2,278 |
| Custom | 사용자 지정 | 사용자 지정 |
