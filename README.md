# Solar PV Planner

건물 옥상에 태양광 패널 배치를 설계하는 웹 애플리케이션입니다. Google Maps 위성 이미지 위에 설치 영역과 제외 영역을 그리고, 패널 크기/방향/간격을 설정하면 자동으로 최적 배치를 계산합니다.

## 주요 기능

- **주소 검색** — Google Places Autocomplete로 건물 위치 탐색
- **위성 지도** — 고해상도 위성 이미지 위에서 작업
- **영역 그리기** — 설치 영역(파란색)과 제외 영역(빨간색) 폴리곤 드로잉
- **폴리곤 편집** — 생성된 영역의 꼭짓점 이동, 드래그로 위치 조정
- **패널 배치 계산** — 크기(mm), 방향(가로/세로), 간격, 마진을 고려한 자동 배치
- **결과 표시** — 패널 수, 설치 면적, 커버리지 비율 실시간 계산

## 기술 스택

- **Next.js 16** (App Router)
- **React 19** (React Compiler 활성화)
- **TypeScript** (strict mode)
- **Tailwind CSS v4**
- **Google Maps JavaScript API** (`@vis.gl/react-google-maps`)
  - Maps, Places, Drawing, Geometry 라이브러리 사용
- **lucide-react** (아이콘)

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

## 사용 방법

1. 주소를 검색하여 대상 건물로 이동합니다
2. **Install Area** 버튼을 클릭하고 옥상 위에 설치 영역 폴리곤을 그립니다
3. 필요시 **Exclude Zone** 버튼으로 장애물(옥탑, 환기구 등) 영역을 표시합니다
4. 패널 크기, 방향, 간격, 마진을 설정합니다
5. **Place Panels** 버튼을 클릭하면 배치 결과가 지도 위에 표시됩니다
6. 결과 패널에서 총 패널 수, 커버리지 면적, 커버리지 비율을 확인합니다
