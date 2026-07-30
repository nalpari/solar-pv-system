---
type: Module
title: Panel Placement
description: 폴리곤 안에 모듈을 최대한 채우는 계산기하 엔진. 인셋·회전·위상 스캔·충돌 판정을 담당한다.
resource: src/app/utils/panelPlacement.ts
tags: [module, geometry, algorithm]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: placement
    resource: src/app/utils/panelPlacement.ts
    title: 구현 (510줄)
  - id: page
    resource: src/app/page.tsx
    title: 호출부 — 단위 변환과 선택 기반 부분 배치
---

# 공개 API

| 함수 | 좌표 | 단위 | 호출자 |
|------|------|------|--------|
| `placePanels` | lat/lng | mm | `page.tsx` (크롭 없는 경로) |
| `placePanelsOnCanvas` | 픽셀 | mm | `placePanelsOnCanvasCm` 내부에서만 |
| `placePanelsOnCanvasCm` | 픽셀 | cm | `page.tsx` (실제 흐름) |
| `isPointInPolygon` | — | — | `CropPopup` 도 히트테스트에 재사용 |

`placePanelsOnCanvas` 는 외부 직접 호출자가 없다. cm ↔ mm 단위 선택 기능을 대비해 남긴 층이다.

# 알고리즘 (면 하나 기준)

```
1. margin 만큼 인셋           insetPolygon(poly, +margin)     → 실패(자기교차)면 이 면 skip
2. 기준변 각도 결정            eaveEdgeIndex 또는 가장 긴 변
3. -angle 회전                처마가 수평이 되도록
4. 개구를 -margin 확장 후 회전  같은 좌표계로 정렬
5. bbox 산출 + eaveAtTop 판정  처마가 위/아래 어느 쪽인지
6. 위상 스캔 10×10            가장 많이 들어가는 배치 채택
7. +angle 역회전 → 원좌표계     lat/lng 또는 픽셀로 복원
```

각 규칙의 의미와 상수값은 [`domain/module-layout-rules.md`](/domain/module-layout-rules.md) 에 있다.

# 내부 헬퍼

| 함수 | 역할 | 주의 |
|------|------|------|
| `insetPolygon(pts, d)` | `d>0` 인셋 / `d<0` 확장 | **Y-up 좌표계 가정**. 변을 법선 방향으로 민 뒤 인접 변끼리 교점을 구한다 |
| `ensureCCW` | 부호 있는 면적으로 CCW 정규화 | 내향 법선 `(-dy, dx)` 가 CCW 를 전제 |
| `isPointInPolygon` | ray casting | 경계 위 점의 판정은 미정의에 가깝다 |
| `segmentsIntersect` | CCW orientation 4회 | **경계 접촉은 교차로 보지 않는다**(부동소수 여유). 엄격 부등호 사용 |
| `panelCrossesPolygon` | 모듈 4변 × 폴리곤 n변 전수 검사 | 오목부를 가로지르는 모듈 검출 |
| `rotate` | 원점 기준 회전 | 원점은 폴리곤 첫 정점 |

# 알려진 특성 / 함정

- **인셋은 근사다.** 오목이 심하거나 좁은 면에서 자기교차가 나면 `signedArea <= 0` 판정으로 빈 배열을 반환하고
  그 면은 통째로 배치 0장이 된다. 예외를 던지지 않으므로 조용히 사라진다.
- **경사 압축은 y축에만.** `ph` 와 `gapY` 에만 `cosSlope` 를 곱한다. x축에 곱하면 처마 방향 길이가 틀어진다.
- **비용은 대략 `면 수 × 100 × 격자칸 수 × O(n)`.** 큰 지붕에서 UI 가 멈출 수 있다.
  `page.tsx` 는 배치 호출을 try/catch 로 감싸 `placementError` 로 표시하지만, 느린 것은 잡지 못한다.
- **결정론적이다.** `crypto.randomUUID()` 로 만드는 `id` 를 빼면 같은 입력에 같은 배치가 나온다.

# 검증 수단

테스트가 없다. 회귀를 확인하려면 실제 지붕면으로 배치해 장수를 비교하는 수밖에 없다 —
이 모듈을 건드릴 때 **최소 하나의 assert 기반 자체 검사를 남기는 것**을 권한다
(예: 정사각형 면 + margin 0 + gap 0 에서 기대 장수가 나오는지).
