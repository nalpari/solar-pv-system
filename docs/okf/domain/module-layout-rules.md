---
type: Concept
title: Module Layout Rules
description: 모듈 배치를 지배하는 규칙 — landscape 고정, 좌우/상하 비대칭 간격, 외주 300mm 이격, 위상 스캔 최대 충진.
resource: src/app/utils/panelPlacement.ts
tags: [domain, layout, placement, constants]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: placement
    resource: src/app/utils/panelPlacement.ts
    title: placePanels 배치 루프
  - id: page
    resource: src/app/page.tsx
    title: GAP_X_CM / GAP_Y_CM / MARGIN_CM 상수
---

# 고정 규칙

| 규칙 | 값 | 근거 |
|------|-----|------|
| 방향 | **landscape 고정** | 모듈 긴 변이 처마와 평행해야 한다는 명세. `PanelOrientation` 타입에 `portrait` 이 있지만 `page.tsx` 는 항상 `"landscape"` 를 넘긴다 |
| 좌우 간격 `GAP_X_CM` | 0.3 cm (3 mm) | 처마 **평행** 방향. 모듈끼리 거의 붙인다 |
| 상하 간격 `GAP_Y_CM` | 3 cm (30 mm) | 처마 **수직** 방향. 경사 압축 대상 |
| 외주 여백 `MARGIN_CM` | 30 cm (300 mm) | 지붕 가장자리 이격 |
| 배치 방식 `layout` | `aligned` \| `staggered` | staggered = 치도리(千鳥). 홀수 행을 `stepX/2` 만큼 민다 |

세 상수는 `page.tsx:46-48` 에 하드코딩되어 있다 — UI 로 노출되지 않는다.

# 여백의 비대칭

- 설치면에는 `margin` 만큼 **안쪽으로** 인셋한다.
- 개구(exclude)에는 `-margin`, 즉 **바깥으로** 확장한다.

즉 천창 주변에도 지붕 가장자리와 같은 300mm 이격이 생긴다. 인셋이 자기교차하면(`signedArea <= 0`)
빈 배열을 돌려 그 면은 통째로 건너뛴다 — 좁은 면에서 배치가 0장 나오는 정상적인 이유다.

# 최대 충진 — 위상 스캔

처마선에 딱 맞춰 시작하지 않는다. **x·y 시작 위상을 각각 10등분해 100가지 조합을 전부 시도하고,
가장 많이 들어가는 배치를 채택한다** (`X_PHASE_STEPS = Y_PHASE_STEPS = 10`).

```
for yPhase in 0..9:          # stepY/10 씩 이동
  for xPhase in 0..9:        # stepX/10 씩 이동
    배치 시도 → collected
    if collected.length > best.length: best = collected
```

의도적으로 **최다 장수를 처마 정렬보다 우선**한다 — 이 도구의 목적이 "최대 몇 장 들어가는가" 시뮬레이션이기 때문.
결과적으로 첫 행이 처마에서 조금 떨어져 보일 수 있는데 버그가 아니다.

비용은 `면 수 × 100 × 격자칸 수 × (점포함 + 변교차 검사)` 다. 큰 면에서 눈에 띄게 느려질 수 있다.

# 유효 배치 판정

모듈 하나가 살아남으려면 네 가지를 모두 통과해야 한다:

1. 4꼭짓점이 전부 인셋 폴리곤 안 (`isPointInPolygon`)
2. 모듈 변이 폴리곤 경계와 교차하지 않음 (`panelCrossesPolygon`) — **오목 폴리곤 방어**.
   1번만으로는 ㄷ자 지붕의 안쪽 홈을 가로지르는 모듈을 못 잡는다.
3. 개구와 겹치지 않음 — 세 방향 검사: 모듈 꼭짓점이 개구 안 / 개구 꼭짓점이 모듈 안 / 변 교차
4. (경사 보정 후) 격자 안에 들어감

# 부분 배치

지붕면을 선택한 상태에서 배치하면 **선택된 면에만** 놓이고 나머지 면의 기존 배치는 보존된다.
아무것도 선택하지 않으면 전체가 대상이다. 삭제 동작도 같은 규칙을 따른다 — 선택 = 부분 영향, 비선택 = 전체.
