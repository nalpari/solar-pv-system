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
- **CropPopup** — Cropped image popup with Canvas-based polygon editor and panel rendering. Supports image save (PNG download)
- **AddressSearch** — Places autocomplete to navigate the map
- **DrawingToolbar** — Crop mode toggle (before crop) / polygon drawing mode controls (after crop)
- **PanelConfig** — Panel size (mm), orientation, gap (cm), and margin (cm) controls
- **ResultsPanel** — Displays panel count and area calculations

## Domain Types (`src/app/types/index.ts`)

`LatLng`, `PanelSize`, `PanelOrientation`, `DrawingMode`, `PolygonArea`, `PlacedPanel`, `CropData`, `CropBounds`, `PixelPoint`, `PixelPolygon`, `PixelPanel`.
