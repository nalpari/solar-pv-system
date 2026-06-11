---
globs:
  - "src/app/components/**/*.tsx"
  - "src/app/page.tsx"
---

# Components & Page Structure

## Page structure

`page.tsx` is a `"use client"` component that owns all application state (areas, panel config, placed panels) and passes it down to child components. No server components beyond `layout.tsx`.

## Key components (`src/app/components/`)

- **MapView** — Google Maps with satellite imagery and crop area selection overlay (html2canvas capture)
- **CropPopup** — Cropped image popup with Canvas-based polygon editor and panel rendering. PNG 저장은 향후 도입 예정
- **RoofEditToolbar** — Floating toolbar over map for polygon editing (select/drawRoof/drawOpening/flowSetting/editRoof/deleteSelected/deleteAll/undo/complete)
- **AiDetectControls** — AI 지붕 분석 트리거 (분석 시작/취소)

`src/app/components/lnb/` (좌측 사이드바):
- **Lnb** — 사이드바 컨테이너 (Design / Simulation 탭)
- **LnbDesign** — 디자인 탭: 주소 검색·경사·모듈 선택·배치
- **LnbSim** — 시뮬레이션 탭: 방위·축전지·월 평균 전기요금

## Domain Types (`src/app/types/index.ts`)

`LatLng`, `PanelSize`, `PanelOrientation`, `DrawingMode`, `PolygonArea`, `PlacedPanel`, `CropData`, `CropBounds`, `PixelPoint`, `PixelPolygon`, `PixelPanel`.
