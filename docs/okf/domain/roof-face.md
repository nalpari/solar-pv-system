---
type: Concept
title: Roof Face
description: 모듈을 놓을 설치면(install)과 놓지 않을 개구(exclude) 폴리곤. 같은 도형이 lat/lng 와 픽셀 두 좌표계로 이중 유지된다.
resource: src/app/types/index.ts
tags: [domain, polygon, geometry]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
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
| 설치면 | `"install"` | 모듈을 배치할 지붕면 | 파랑 `#3366AA` |
| 개구 | `"exclude"` | 천창·굴뚝·설비 등 배치 금지 영역 | 빨강 `#CF2E2E` |

AI 자동 감지 결과는 **전부 `install` 로 매핑**된다(`normalizedToPixelPolygons`). 개구는 사용자가 직접 그린다.

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
- 인접한 install 면 여러 개를 선택해 하나로 합칠 수 있다 → [`modules/merge-polygons.md`](/modules/merge-polygons.md).
- 처마 기준선을 바꾸면 **그 폴리곤 위 모듈만** 삭제된다(`handleEaveChange`). 다른 면의 배치는 보존된다.
