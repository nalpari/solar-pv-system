# Solar PV Planner — 시스템 아키텍처

## 1. 시스템 개요

건물 옥상에 태양광 패널 배치를 설계하는 싱글 페이지 애플리케이션(SPA).
Google Maps 위성 이미지 위에 설치/제외 영역을 폴리곤으로 그리고, 패널 크기/방향/간격을 설정하면 최적 배치를 자동 계산합니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                        │
│                                                                │
│  ┌──────────────────────┐  ┌────────────────────────────────┐  │
│  │    Left Sidebar      │  │         Main Map Area          │  │
│  │  ┌────────────────┐  │  │                                │  │
│  │  │ AddressSearch   │  │  │  ┌──────────────────────────┐  │  │
│  │  ├────────────────┤  │  │  │      Google Maps          │  │  │
│  │  │ DrawingToolbar  │  │  │  │   (Satellite View)       │  │  │
│  │  ├────────────────┤  │  │  │                            │  │  │
│  │  │ PanelConfig     │  │  │  │  ┌─ DrawingOverlay ─────┐ │  │  │
│  │  ├────────────────┤  │  │  │  │ Polygon Drawing       │ │  │  │
│  │  │ [Place Panels]  │  │  │  │  │ Area Management      │ │  │  │
│  │  ├────────────────┤  │  │  │  └───────────────────────┘ │  │  │
│  │  │ ResultsPanel    │  │  │  │  ┌─ PanelOverlay ──────┐  │  │  │
│  │  └────────────────┘  │  │  │  │ Placed Panels        │  │  │  │
│  │                      │  │  │  └──────────────────────┘  │  │  │
│  │  ┌────────────────┐  │  │  │                            │  │  │
│  │  │ Footer (i18n)   │  │  │  │  MapControls             │  │  │
│  │  └────────────────┘  │  │  └──────────────────────────┘  │  │
│  └──────────────────────┘  └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │  Google Maps APIs   │
                    │  - Maps JavaScript  │
                    │  - Places           │
                    │  - Drawing          │
                    │  - Geometry         │
                    └────────────────────┘
```

## 2. 컴포넌트 아키텍처

### 2.1 컴포넌트 트리

```
RootLayout (Server Component)
  └─ Home (Client Component) ← 전체 상태 소유
       ├─ APIProvider (@vis.gl/react-google-maps)
       │    ├─ Header
       │    ├─ AddressSearch ──→ Google Places Autocomplete
       │    ├─ DrawingToolbar
       │    ├─ PanelConfig
       │    ├─ [Place Panels Button]
       │    ├─ ResultsPanel
       │    └─ MapView
       │         ├─ Map (@vis.gl/react-google-maps)
       │         ├─ CenterUpdater
       │         ├─ DrawingOverlay ──→ google.maps.drawing.DrawingManager
       │         ├─ PanelOverlay ──→ google.maps.Polygon[]
       │         └─ MapControls
       └─ (API Key missing fallback)
```

### 2.2 상태 관리 패턴

**Props-Down / Callbacks-Up** — `page.tsx`가 모든 상태를 소유합니다.

| 상태 | 타입 | 소유자 | 소비자 |
|------|------|--------|--------|
| `lang` | `Lang` | Home | 모든 컴포넌트 |
| `center` | `{lat, lng}` | Home | MapView, MapControls |
| `drawingMode` | `DrawingMode` | Home | DrawingToolbar, MapView |
| `areas` | `PolygonArea[]` | Home | DrawingToolbar, MapView, ResultsPanel |
| `panelSize` | `PanelSize` | Home | PanelConfig, ResultsPanel |
| `orientation` | `PanelOrientation` | Home | PanelConfig, ResultsPanel |
| `gap` | `number` | Home | PanelConfig |
| `margin` | `number` | Home | PanelConfig |
| `placedPanelsList` | `PlacedPanel[]` | Home | MapView, ResultsPanel |

## 3. 데이터 흐름

### 3.1 주소 검색 흐름

```
User Input → AddressSearch
  → [300ms debounce]
  → AutocompleteService.getPlacePredictions()
  → Prediction List 표시
  → User 선택
  → PlacesService.getDetails()
  → onPlaceSelect({ lat, lng, address })
  → Home.setCenter()
  → CenterUpdater.map.panTo()
```

### 3.2 폴리곤 드로잉 흐름

```
DrawingToolbar.onModeChange("install" | "exclude")
  → Home.setDrawingMode()
  → DrawingOverlay 활성화
  → DrawingManager 생성
  → User가 지도에 폴리곤 그림
  → "polygoncomplete" 이벤트
  → onAreaComplete({ id, type, paths })
  → Home.setAreas([...prev, newArea])
  → placedPanelsList 초기화

폴리곤 편집:
  → "set_at" / "insert_at" / "remove_at" / "dragend" 이벤트
  → onAreasChange(updatedAreas)
  → Home.setAreas(updatedAreas)
  → placedPanelsList 초기화
```

### 3.3 패널 배치 계산 흐름

```
User clicks "Place Panels"
  → handlePlacePanels()
  → placePanels(installAreas, excludeAreas, panelSize, orientation, gap, margin)
  │
  │  For each installArea:
  │    1. toLocal(): lat/lng → 로컬 미터 좌표 변환
  │    2. insetPolygon(): 마진만큼 내부 축소
  │    3. 가장 긴 변의 각도 계산
  │    4. rotate(): 그리드 정렬을 위해 회전
  │    5. 바운딩 박스 내 그리드 순회
  │    6. isPointInPolygon(): 4개 꼭짓점 유효성 검증
  │    7. 제외 영역 충돌 검사 (양방향)
  │    8. rotate() 역변환 + toLatLng(): 좌표 복원
  │
  → PlacedPanel[] 반환
  → setPlacedPanelsList(panels)
  → PanelOverlay가 지도 위에 렌더링
  → ResultsPanel이 통계 표시
```

## 4. 핵심 알고리즘 — panelPlacement.ts

### 4.1 좌표 변환

```
                 lat/lng (WGS84)
                      │
            ┌─────────┴─────────┐
            │   toLocal()       │  위도 보정 포함
            │   lng → x (m)    │  x = Δlng × 111320 × cos(lat)
            │   lat → y (m)    │  y = Δlat × 111320
            └─────────┬─────────┘
                      │
              로컬 미터 좌표 (Point)
                      │
            ┌─────────┴─────────┐
            │   toLatLng()      │  역변환
            └───────────────────┘
```

### 4.2 폴리곤 인셋 알고리즘

```
원본 폴리곤                    인셋 폴리곤
   ┌────────────┐                ┌──────────┐
   │            │    margin →    │  ┌──────┐ │
   │            │                │  │      │ │
   │            │                │  │      │ │
   │            │                │  └──────┘ │
   └────────────┘                └──────────┘

1. ensureCCW(): 반시계 방향 정규화
2. 각 변의 내부 법선 벡터 계산
3. 법선 방향으로 distance만큼 오프셋
4. lineIntersection(): 인접 오프셋 변의 교점 계산
5. signedArea() > 0 검증 (자기 교차 방지)
```

### 4.3 그리드 배치 전략

```
Step 1: 가장 긴 변 찾기
   ╲──────────────────────╲   ← 이 변에 그리드 정렬
    ╲                      ╲
     ╲──────────────────────╲

Step 2: 그리드 정렬 회전
   ┌──────────────────────┐
   │ ┌──┐ ┌──┐ ┌──┐ ┌──┐ │
   │ │  │ │  │ │  │ │  │ │   stepX = panelWidth + gap
   │ └──┘ └──┘ └──┘ └──┘ │   stepY = panelHeight + gap
   │ ┌──┐ ┌──┐ ┌──┐ ┌──┐ │
   │ │  │ │  │ │  │ │  │ │
   │ └──┘ └──┘ └──┘ └──┘ │
   └──────────────────────┘

Step 3: 유효성 검증
   - 4개 꼭짓점이 인셋 폴리곤 내부인가?
   - 제외 영역과 겹치지 않는가? (양방향 검사)

Step 4: 좌표 복원 (역회전 + lat/lng 변환)
```

## 5. 외부 의존성

```
┌─────────────────────────────────────────┐
│              Application                │
│                                         │
│  @vis.gl/react-google-maps              │
│    └─ Google Maps JavaScript API        │
│         ├─ Maps (satellite/roadmap)     │
│         ├─ Drawing Library              │
│         │    └─ DrawingManager          │
│         ├─ Places Library               │
│         │    ├─ AutocompleteService      │
│         │    └─ PlacesService            │
│         └─ Geometry Library             │
│              └─ spherical.computeArea() │
│                                         │
│  lucide-react (아이콘)                   │
│  next/font/google (Geist 폰트)          │
│  next/image (이미지 최적화)              │
└─────────────────────────────────────────┘
```

## 6. 배포 아키텍처

```
┌─────────────────────────────────────────────┐
│                Docker Container              │
│                                              │
│  ┌─── Build Stage ──────────────────────┐    │
│  │  node:20-alpine                      │    │
│  │  pnpm install → next build           │    │
│  │  (standalone output)                  │    │
│  └──────────────────────────────────────┘    │
│                    │                         │
│  ┌─── Runtime Stage ────────────────────┐    │
│  │  node:20-alpine (minimal)            │    │
│  │  .next/standalone/server.js          │    │
│  │  .next/static/                        │    │
│  │  public/                              │    │
│  │                                       │    │
│  │  USER: nextjs (non-root)             │    │
│  │  PORT: 3000                           │    │
│  └──────────────────────────────────────┘    │
│                                              │
└─────────────────────────────┬───────────────┘
                              │ :3000
                         ┌────┴────┐
                         │ Browser │
                         └─────────┘
```

## 7. 타입 시스템

```
LatLng { lat, lng }
    │
    ├── PolygonArea { id, type: "install"|"exclude", paths: LatLng[] }
    │       │
    │       └── Input to → placePanels()
    │
    └── PlacedPanel { id, corners: [LatLng, LatLng, LatLng, LatLng] }
            │
            └── Output from → placePanels()

PanelSize { label, width(mm), height(mm) }
    │
    └── PanelOrientation: "portrait" | "landscape"
            │
            └── Affects actual W/H swap in placePanels()

DrawingMode: "install" | "exclude" | null
    │
    └── Controls DrawingManager activation

Lang: "ja" | "en"
    │
    └── i18n translation key lookup
```
