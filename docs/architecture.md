# Solar PV Planner - 시스템 아키텍처

## 1. 시스템 개요

건물 옥상에 태양광 모듈 배치를 설계하는 싱글 페이지 애플리케이션입니다.
Google Maps 위성 이미지에서 대상 건물 영역을 크롭하고, 크롭 이미지 위의 캔버스 에디터에서 지붕면과 개구부 폴리곤을 그린 뒤 자동으로 모듈 배치를 계산합니다.

```
Browser (Client)
├─ Left Sidebar
│  ├─ Header (Hanwha Japan logo)
│  ├─ Design / Simulation tabs
│  ├─ AddressSearch
│  ├─ Roof edit controls
│  ├─ PanelConfig
│  ├─ ResultsPanel
│  ├─ SimulationPanel
│  └─ Footer language toggle
└─ Main Map Area
   ├─ Google Maps satellite/roadmap view
   ├─ Crop selection overlay
   ├─ RoofEditToolbar (floating)
   └─ CropPopup
      ├─ Captured map image
      ├─ Canvas polygon editor
      ├─ Pixel panel rendering
      └─ PNG save

Google Maps APIs
├─ Maps JavaScript
├─ Places
└─ Geometry
```

## 2. 컴포넌트 아키텍처

### 2.1 컴포넌트 트리

```
RootLayout (Server Component)
└─ Home (Client Component, state owner)
   └─ APIProvider (@vis.gl/react-google-maps, libraries: places + geometry)
      ├─ Header
      ├─ Sidebar
      │  ├─ AddressSearch
      │  ├─ PanelConfig
      │  ├─ ResultsPanel
      │  ├─ SimulationPanel
      │  └─ Language toggle
      ├─ RoofEditToolbar
      ├─ MapView
      │  ├─ Map (@vis.gl/react-google-maps)
      │  ├─ ViewUpdater
      │  ├─ WheelZoomController
      │  └─ CropOverlay
      ├─ CropPopup
      │  └─ Canvas polygon editor
      └─ API key missing fallback
```

### 2.2 상태 관리 패턴

**Props-Down / Callbacks-Up** 패턴을 사용합니다. [page.tsx](../src/app/page.tsx)가 대부분의 상태를 소유하고, 자식 컴포넌트는 props와 callback으로 연결됩니다.

| 상태 | 타입 | 소유자 | 소비자 |
|------|------|--------|--------|
| `lang` | `Lang` | Home | 모든 UI 컴포넌트 |
| `activeTab` | `"design"` \| `"simulation"` | Home | Sidebar |
| `center` | `{ lat, lng }` | Home | MapView |
| `viewport` | `google.maps.LatLngBounds \| null` | Home | MapView |
| `cropMode` | `boolean` | Home | MapView |
| `cropData` | `CropData \| null` | Home | CropPopup, Sidebar |
| `roofEditing` | `boolean` | Home | RoofEditToolbar, CropPopup |
| `roofEditTool` | `RoofTool` | Home | RoofEditToolbar, CropPopup |
| `drawingMode` | `DrawingMode` | Home derived value | CropPopup |
| `areas` | `PolygonArea[]` | Home | CropPopup, ResultsPanel |
| `pixelAreas` | `{ areas, metersPerPixel } \| null` | Home | panel placement |
| `panelSize` | `PanelSize` | Home | PanelConfig, ResultsPanel |
| `orientation` | `PanelOrientation` | Home | ResultsPanel |
| `placedPixelPanels` | `PixelPanel[]` | Home | CropPopup, ResultsPanel |
| `simForm` | `SimulationFormState` | Home | SimulationPanel |

## 3. 데이터 흐름

### 3.1 주소 검색 흐름

```
User input
→ AddressSearch debounce
→ AutocompleteService.getPlacePredictions()
→ Prediction 선택
→ PlacesService.getDetails()
→ onPlaceSelect({ lat, lng, address, viewport })
→ Home.setCenter(), setAddress(), setViewport()
→ MapView pans/fits the map
```

### 3.2 크롭 및 폴리곤 편집 흐름

```
Confirm Building
→ MapView cropMode 활성화
→ CropOverlay 드래그/리사이즈
→ html2canvas로 지도 영역 캡처
→ onCropComplete(CropData)
→ CropPopup 표시
→ RoofEditToolbar 도구 선택
   ├─ drawRoof: install polygon 작성
   ├─ drawOpening: exclude polygon 작성
   ├─ flowSetting: install polygon의 eaveEdgeIndex 지정
   └─ editRoof/select: 이동, 꼭짓점 편집, 삭제
→ CropPopup.notifyParent()
   ├─ onAreasChange(PolygonArea[])
   └─ onPixelAreasChange(PixelPolygon[], metersPerPixel)
```

현재 폴리곤 편집은 Google Drawing Library가 아니라 `CropPopup`의 Canvas + Pointer Events 기반으로 동작합니다.

### 3.3 패널 배치 계산 흐름

```
User clicks "Place Modules"
→ handlePlacePanels()
→ portrait / landscape 양쪽 계산
→ 더 많은 패널이 들어가는 orientation 채택

크롭 경로:
  placePanelsOnCanvasCm(
    installPx, excludePx,
    panelSize.width, panelSize.height,
    orientation, GAP_CM, MARGIN_CM, metersPerPixel
  )
  → PixelPanel[]
  → CropPopup canvas overlay 렌더링

lat/lng 경로:
  placePanels(installAreas, excludeAreas, panelSize, orientation, gapMm, marginMm)
  → PlacedPanel[]
```

## 4. 핵심 알고리즘 - panelPlacement.ts

### 4.1 좌표 변환

```
lat/lng (WGS84)
→ local meters (latitude-adjusted x/y)
→ pixel coordinates for canvas placement
→ panel corners restored to the output coordinate system
```

캔버스 좌표는 화면 좌표계의 Y축이 아래로 증가하므로, 배치 계산 중에는 Y축을 반전해 수학 좌표계로 변환한 뒤 결과를 다시 픽셀 좌표로 복원합니다.

### 4.2 폴리곤 인셋

1. `ensureCCW()`로 반시계 방향 정규화
2. 각 변의 내부 법선 벡터 계산
3. `margin`만큼 내부 오프셋
4. `lineIntersection()`으로 인접 오프셋 변의 교점 계산
5. 유효한 인셋 폴리곤일 때만 배치 진행

### 4.3 처마 평행 그리드 배치

1. `eaveEdgeIndex`가 있으면 해당 변을 기준축으로 사용
2. 없으면 가장 긴 변을 기준축으로 사용
3. 기준축에 맞춰 인셋 폴리곤과 제외 영역을 회전
4. `panelWidth + gap`, `panelHeight + gap` 간격으로 그리드 순회
5. 패널 4개 꼭짓점이 설치 영역 내부이고 제외 영역과 충돌하지 않을 때만 채택
6. 결과 좌표를 역회전해 반환

## 5. 외부 의존성

```
@vis.gl/react-google-maps
├─ Google Maps JavaScript API
├─ Places Library
│  ├─ AutocompleteService
│  └─ PlacesService
└─ Geometry Library
   └─ spherical.computeArea()

html2canvas
└─ Map container capture and crop image generation

lucide-react
└─ UI icons

next/font/google
└─ Figtree, Noto Sans JP, Geist Mono

next/image
└─ Header logo optimization
```

## 6. 배포 아키텍처

```
Docker Container
├─ Build stage
│  ├─ node:20-alpine
│  ├─ pnpm install --frozen-lockfile
│  └─ pnpm build (standalone output)
└─ Runtime stage
   ├─ node:20-alpine
   ├─ .next/standalone/server.js
   ├─ .next/static
   ├─ public
   └─ non-root nextjs user, PORT=3000
```

## 7. 타입 시스템

```
CropData
├─ imageDataUrl
├─ bounds: CropBounds
└─ sizeMeters

PolygonArea
├─ id
├─ type: "install" | "exclude"
├─ paths: LatLng[]
└─ eaveEdgeIndex?

PixelPolygon
├─ id
├─ type: "install" | "exclude"
├─ points: PixelPoint[]
└─ eaveEdgeIndex?

PixelPanel / PlacedPanel
├─ id
├─ polygonId
└─ corners[4]

DrawingMode
└─ "install" | "exclude" | null

Lang
└─ "ja" | "en"
```
