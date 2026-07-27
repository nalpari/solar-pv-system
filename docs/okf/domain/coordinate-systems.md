---
type: Concept
title: Coordinate Systems
description: lat/lng ↔ 로컬 미터 ↔ 캔버스 픽셀 세 좌표계와 mm/cm/m 세 단위계. 이 프로젝트에서 가장 실수하기 쉬운 지점.
resource: src/app/utils/panelPlacement.ts
tags: [domain, geometry, units, gotcha]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: placement
    resource: src/app/utils/panelPlacement.ts
    title: toLocal / toLatLng / metersPerPixel 변환
  - id: mapview
    resource: src/app/components/MapView.tsx
    title: sizeMeters 산출 — metersPerPixel 의 출처
---

# 세 좌표계

| 좌표계 | 타입 | Y축 | 어디서 |
|--------|------|-----|--------|
| 지리 | `LatLng` | 북쪽이 + | 지도, `PolygonArea`, `PlacedPanel` |
| 로컬 미터 | `Point {x,y}` | 북쪽이 + (수학 좌표계) | `panelPlacement.ts` 내부 계산 전용 |
| 캔버스 픽셀 | `PixelPoint` | **아래가 +** | `CropPopup` 캔버스, `PixelPolygon`, `PixelPanel` |

# 지리 ↔ 로컬 미터

폴리곤의 첫 정점을 원점으로 삼는 평면 근사다.

```ts
const METERS_PER_LAT = 111320;
metersPerLng(lat) = 111320 * cos(lat * π / 180)
```

크롭 한 장(수십 미터) 범위에서만 쓰이므로 곡률 오차는 무시 가능하다.
**원점이 폴리곤마다 다르다** — 서로 다른 면의 로컬 좌표를 섞어 쓰면 안 된다.

# 픽셀 ↔ 미터

`CropData.sizeMeters` 와 캔버스 크기에서 유도한 `metersPerPixel` 스칼라 하나로 환산한다.
크롭 영역이 정사각형에 가깝다는 전제이며 x/y 를 구분하지 않는다.

# ⚠️ Y축 반전

캔버스는 Y 가 아래로 증가한다. 인셋/확장(`insetPolygon`)은 CCW 판정과 내향 법선 계산에 부호를 쓰므로
**수학 좌표계(Y up)를 가정한다**. 픽셀 좌표를 그대로 넣으면 인셋과 확장이 뒤바뀐다.

> 규칙: 픽셀 좌표로 `insetPolygon` 을 호출하기 전에 Y 를 뒤집고, 결과를 받은 뒤 다시 뒤집는다.

# 단위 체계

| 층 | 단위 |
|----|------|
| UI 입력 / `page.tsx` 상수 | **cm** (`GAP_X_CM`, `GAP_Y_CM`, `MARGIN_CM`) |
| `PanelSize.width/height`, QSP 마스터 | **mm** |
| 배치 함수 내부 계산 | **m** |

`panelPlacement.ts` 는 세 진입점을 노출한다:

| 함수 | 좌표 | 단위 | 상태 |
|------|------|------|------|
| `placePanels` | lat/lng | mm | 지도 직접 배치 경로 |
| `placePanelsOnCanvas` | 픽셀 | mm | cm 버전이 내부적으로 호출. 직접 호출부 없음 |
| `placePanelsOnCanvasCm` | 픽셀 | cm | **`page.tsx` 가 쓰는 실제 진입점** |

cm 버전은 mm 버전을 감싸기만 한다(×10). mm 버전은 2026-03-20 에 UI 를 cm 로 바꾸면서
"향후 단위 선택 기능"을 위해 남겨둔 것으로, 현재 외부 호출자가 없다.

# 실수 체크리스트

- 픽셀 좌표를 인셋하기 전에 Y 를 뒤집었는가
- cm 를 mm 로 바꾸지 않고 넘기지 않았는가 (10배 차이 — 배치가 0장이 되거나 지붕을 덮어버린다)
- 서로 다른 폴리곤의 로컬 미터 좌표를 섞지 않았는가
- 회전각 `angle` 로 배치하고 `-angle` 로 되돌렸는가 (부호를 뒤집으면 격자가 거울상이 된다)
