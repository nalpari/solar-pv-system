---
globs:
  - "src/app/utils/**/*.ts"
---

# Core Logic & Utilities

## panelPlacement.ts — Computational geometry engine

- `placePanels` — lat/lng-based (mm unit): converts to local meters, grid-aligns to longest edge, validates containment
- `placePanelsOnCanvas` — pixel-based (mm unit): uses metersPerPixel scale factor, flips Y-axis for canvas coordinates
- `placePanelsOnCanvasCm` — pixel-based (cm unit): UI entry point, internally calls mm version

### Key concepts

- Coordinate conversion: lat/lng -> local meters -> pixel
- Unit system: mm for internal calculation, cm for UI-facing API
- Y-axis flip required for canvas coordinate system
- Grid alignment uses polygon's longest edge as reference axis
