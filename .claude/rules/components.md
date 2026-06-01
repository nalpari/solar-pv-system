---
globs:
  - "src/app/components/**/*.tsx"
  - "src/app/page.tsx"
---

# Components & Page Structure

## Page structure

`page.tsx` is a `"use client"` component that owns all application state (areas, panel config, placed panels) and passes it down to child components. No server components beyond `layout.tsx`.

## Key components (`src/app/components/`)

- **Header** — App header with logo and navigation
- **MapView** — Google Maps with satellite imagery and crop area selection overlay (html2canvas capture)
- **CropPopup** — Cropped image popup with Canvas-based polygon editor and panel rendering. PNG 저장은 향후 도입 예정
- **AddressSearch** — Places autocomplete to navigate the map
- **RoofEditToolbar** — Floating toolbar over map for polygon editing (select/drawRoof/drawOpening/flowSetting/editRoof/deleteSelected/deleteAll/undo/complete)
- **PanelConfig** — Panel size (mm), orientation, gap (cm), and margin (cm) controls
- **ResultsPanel** — Displays panel count and area calculations
- **SimulationPanel** — Generation simulation inputs (azimuth, battery, monthly electric cost) and results view

## Domain Types (`src/app/types/index.ts`)

`LatLng`, `PanelSize`, `PanelOrientation`, `DrawingMode`, `PolygonArea`, `PlacedPanel`, `CropData`, `CropBounds`, `PixelPoint`, `PixelPolygon`, `PixelPanel`.
