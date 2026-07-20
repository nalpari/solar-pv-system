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

## mergePolygons.ts — 지붕면 병합 (인접 판정 + union)

- `mergeAreaPolygons(polys)` — 선택된 지붕면들을 하나로 병합해 외곽 링을 반환, 병합 불가면 `null`
- **버튼 활성 판정과 실제 병합이 이 함수 하나를 공유** → 두 판정이 어긋나("버튼은 켜지는데 무반응") 발생하지 않음
- 입력·출력 모두 캔버스 픽셀 좌표(`PixelPoint[]`)

### 판정 순서 (bridge-then-union)

1. **면 포개짐 배제** — 어떤 두 면이라도 그 쌍의 작은 면 대비 `OVERLAP_RATIO`(5%) 초과로 area가 겹치면 거부. 면을 옮기다 포개진 것은 "인접"이 아님. 쌍 단위 판정이라 무관한 면이 섞여도 다른 쌍 판정이 흔들리지 않음
2. **필러 생성(bridge)** — 근접(`GAP_TOL` 3px 이내)하고 `MIN_OVERLAP`(10px) 이상 겹치는 변쌍의 틈을 얇은 사각형으로 메움 → AI 분할면의 미세 gap·회전 흡수
3. **union** — 원본 + 필러를 `polygon-clipping`으로 합침. 결과가 단일 폴리곤이 아니면(코너접촉·분리된 면) `null`
4. **구멍 거부** — 결과에 hole(중정 등)이 있으면 `null` — 빈 공간을 메워 없는 지붕을 만들지 않음
5. **톱니 단순화** — 미세 회전으로 생긴 준-공선 정점(수직편차 `SIMPLIFY_EPS` 0.5px 미만)을 제거
