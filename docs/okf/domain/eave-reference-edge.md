---
type: Concept
title: Eave Reference Edge (처마 기준변)
description: 지붕면의 어느 변이 처마인지. 모듈 격자의 회전각과 배치 시작 방향을 이 하나가 결정한다.
resource: src/app/utils/panelPlacement.ts
tags: [domain, geometry, layout]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: placement
    resource: src/app/utils/panelPlacement.ts
    title: placePanels — 기준변 각도·앵커 결정부
  - id: types
    resource: src/app/types/index.ts
    title: PolygonArea.eaveEdgeIndex
---

# 정의

`eaveEdgeIndex: number` — 폴리곤 정점 배열에서 `points[i] → points[i+1]` 로 이어지는 변의 인덱스 `i`.
지붕의 **처마(물이 흘러 떨어지는 아래쪽 변)** 를 가리킨다. UI 상 `flowSetting`("흐름 설정") 도구로 지정하고
캔버스에서 주황색 `#FF8A00` 으로 강조된다.

# 이 값이 결정하는 것

1. **격자 회전각** — `angle = atan2(p2.y - p1.y, p2.x - p1.x)`. 폴리곤을 `-angle` 만큼 회전시켜 처마를 수평으로 만든 뒤
   축 정렬 격자로 배치하고, 배치가 끝나면 다시 `+angle` 로 되돌린다.
2. **모듈 방향** — 모듈의 긴 변이 처마와 평행해진다(landscape 고정). [`module-layout-rules.md`](module-layout-rules.md) 참조.
3. **경사 압축 축** — [경사(寸)](roof-slope-sun.md) 의 cos 보정이 **처마에 수직인 방향**에만 적용된다.
4. **행 진행 방향** — 회전 후 처마선의 y 좌표가 bbox 의 위/아래 어느 쪽에 가까운지(`eaveAtTop`)를 보고
   처마 쪽에서 안쪽으로 행을 쌓아간다.

# 미지정 시 폴백

`eaveEdgeIndex` 가 없거나 범위를 벗어나면 **가장 긴 변**을 대신 쓴다. 배치 함수와
`aiDetect.normalizedToPixelPolygons` 가 각각 같은 로직(`findLongestEdgeIndex`)을 갖고 있다.

AI 감지 결과에는 생성 시점에 가장 긴 변이 자동으로 부여된다 — 사용자가 흐름 설정을 하지 않아도
분석 직후 바로 배치할 수 있어야 한다는 UX 약속 때문이다.

# 주의

- 인덱스는 **정점 배열에 종속적**이다. 병합·꼭짓점 편집으로 정점 순서가 바뀌면 가리키는 변이 달라진다.
  실제로 [`mergeAreaPolygons`](/modules/merge-polygons.md) 는 `eaveEdgeIndex` 를 승계하지 않는다 — 병합 결과는 폴백(가장 긴 변)으로 시작한다.
- 처마를 바꾸면 격자 전체가 회전하므로 기존 배치가 무의미해진다. 그래서 해당 폴리곤 위 모듈만 삭제된다.
