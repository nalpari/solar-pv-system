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
- 기준축: 처마(`eaveEdgeIndex`), 없으면 가장 긴 변. 패널 긴 변이 처마와 평행(landscape)
- 경사(寸) cos 투영 보정으로 처마 수직 방향 압축
- x·y 시작 위상 스캔으로 최대 충진 배치 채택, 오목부/장애물은 변 교차 검사로 방어
- 외주 이격(margin): 설치 폴리곤은 내부 인셋, 제외(개구) 폴리곤은 바깥 확장 — 개구 주변에도 동일 이격
- 간격: 좌우(gapX) / 상하(gapY) 분리, 배치 방식 `layout` = aligned / staggered(치도리)
