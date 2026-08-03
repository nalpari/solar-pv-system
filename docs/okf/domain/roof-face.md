---
type: Concept
title: Roof Face
description: 모듈을 놓을 설치면(install)과 놓지 않을 개구(exclude) 폴리곤. 같은 도형이 lat/lng 와 픽셀 두 좌표계로 이중 유지된다.
resource: src/app/types/index.ts
tags: [domain, polygon, geometry]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
verified: { by: claude-code/opus-5, at: 2026-08-03T00:00:00Z }
status: stable
sources:
  - id: types
    resource: src/app/types/index.ts
    title: PolygonArea / PixelPolygon 타입 정의
  - id: croppopup
    resource: src/app/components/CropPopup.tsx
    title: 폴리곤 편집 캔버스
---

# 두 가지 면

| 종류 | `type` | 의미 | 렌더 색 |
|------|--------|------|---------|
| 설치면 | `"install"` | 모듈을 배치할 지붕면 | **면마다 다름** — 30색 팔레트 순환 (아래) |
| 개구 | `"exclude"` | 천창·굴뚝·설비 등 배치 금지 영역 | 빨강 `#CF2E2E` (단색 고정) |

AI 자동 감지 결과는 **전부 `install` 로 매핑**된다(`normalizedToPixelPolygons`). 개구는 사용자가 직접 그린다.

# 설치면 색 배정

여러 면을 한눈에 구분하려고 설치면은 `ROOF_FACE_COLORS`(30색, `src/app/utils/roofColors.ts`)에서 색을 받는다.

- **인덱스는 상태가 아니라 파생값이다.** `areas` 에서 `type === "install"` 인 것만 필터링한 **등장 순서**(0,1,2,…)가 곧 팔레트 인덱스다.
  `PixelPolygon` / `PolygonArea` 에 `color` 나 `colorIndex` 필드는 **없다** — 캔버스 draw 시점에 `id → 인덱스` Map 을 매번 새로 만든다.
- 그래서 그리기·삭제·병합·undo·AI 재감지 어느 경로로 `areas` 가 바뀌어도 색 배정이 자동으로 일관된다.
  대신 **색이 이동한다**: 면을 삭제하면 그 뒤 면들의 색이 한 칸씩 당겨지고, 병합하면 새 면이 배열 끝에 붙어 마지막 색을 받는다. 의도된 트레이드오프다.
- 설치면이 31개를 넘으면 인덱스가 순환해 0번색부터 재사용된다 — 30개 이하인 동안에는 색 중복이 구조적으로 불가능하다.
- **그 면 위의 모듈도 같은 색을 따른다.** `PlacedPanel.polygonId` 로 소속 면의 인덱스를 찾아 같은 색의 반투명 fill + 실색 stroke 로 그린다.
  소속 면을 찾지 못하면 구 파랑 `#3366AA` 로 폴백한다.
- 팔레트는 상태색 — 선택 `#FFD700`(gold) · 처마 `#FF8A00`(orange) · 개구 `#CF2E2E`(red) — 의 색역을 배제하고 골랐다.
  **상태 표시가 면 색을 항상 이긴다**: 선택된 면은 gold 테두리, 처마 기준변은 orange 하이라이트가 팔레트 색 위에 덮인다.

# 두 좌표계, 하나의 도형

같은 지붕면이 두 타입으로 동시에 존재한다.

| 타입 | 좌표 | 소유자 | 쓰임 |
|------|------|--------|------|
| `PolygonArea` | `paths: LatLng[]` | `page.tsx` 의 `areas` | 지도 기반 배치(`placePanels`) |
| `PixelPolygon` | `points: PixelPoint[]` | `CropPopup` 내부 → `page.tsx` 의 `pixelAreas` | 캔버스 편집·렌더, 실제 배치 경로 |

`page.tsx:512` 의 `if (pixelAreas)` 분기가 말해주듯 **크롭 팝업이 열려 있으면 픽셀 경로가 항상 이긴다**.
lat/lng 경로는 크롭 없이 지도에 직접 그리는 경우를 위해 남아 있으나 현재 UI 흐름에서는 도달하기 어렵다.

# 불변식

- 유효한 폴리곤은 점 3개 이상. 미만이면 배치 함수가 조용히 건너뛴다(`if (area.paths.length < 3) continue`).
- `id` 는 `crypto.randomUUID()`. 배치된 모듈([`PlacedPanel`](/domain/module-layout-rules.md))이 `polygonId` 로 이 id 를 참조한다.
- **폴리곤이 사라지면 그 위 모듈도 사라진다.** `handleAreasChange` / `handlePixelAreasChange` 가 살아있는 id 집합으로
  `placedPanels` 와 `selectedRoofIds` 를 필터링해 고아 참조를 만들지 않는다.
- **install 이 0개가 되면 경사·모듈 선택이 초기화된다** (`resetSlopeAndModule`). exclude 만 남은 상태는 install 0개로 센다.
- `eaveEdgeIndex` 는 선택 항목이다. 없으면 배치 시 가장 긴 변이 대신 쓰인다 — [`eave-reference-edge.md`](eave-reference-edge.md).

# 편집 조작

`CropPopup` 캔버스에서:

- 꼭짓점 스냅 반경 `SNAP_RADIUS = 10px` — 첫 점을 다시 클릭하면 폴리곤이 닫히고, 다른 install 면의 꼭짓점에 붙는다.
- **겹친 꼭짓점은 함께 끌린다.** 스냅으로 붙은 인접 지붕면들은 같은 좌표에 꼭짓점을 여러 겹 갖게 되는데,
  지붕 편집 모드에서 그중 하나를 드래그하면 `VERTEX_LINK_RADIUS = 6px` 안에 겹쳐 있던 다른 install 면의
  꼭짓점이 같은 좌표로 따라온다 — 맞닿아 있던 면 사이가 벌어지지 않는다.
  묶음은 **폴리곤당 가장 가까운 꼭짓점 하나씩**이고, 개구(exclude)는 딸려오지 않는다.
- **Alt(Option)를 누른 채 끌면 집은 꼭짓점 하나만** 움직인다 — 붙어 있던 면을 떼어낼 때 쓴다.
  드래그 도중에 눌렀다 떼도 다음 move 부터 바로 반영된다. 이때도 묶음 전체는 스냅 대상에서 빠지는데,
  남겨둔 꼭짓점에 도로 흡착되면 `SNAP_RADIUS` 안에서는 영영 뗄 수 없기 때문이다.
- 드래그가 끝나면 **실제로 좌표가 바뀐 면**의 처마 기준선이 리셋되고 그 위 모듈이 삭제된다.
  함께 끌었으면 그 면들 전부, Alt 로 하나만 옮겼으면 그 하나만 해당된다 — 건드리지 않은 면의 배치는 보존된다.
- 인접한 install 면 여러 개를 선택해 하나로 합칠 수 있다 → [`modules/merge-polygons.md`](/modules/merge-polygons.md).
- 처마 기준선을 바꾸면 **그 폴리곤 위 모듈만** 삭제된다(`handleEaveChange`). 다른 면의 배치는 보존된다.
