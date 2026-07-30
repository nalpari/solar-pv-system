---
type: Concept
title: Roof Slope (寸 / sun)
description: 일본 건축의 경사 단위 — 수평 10에 대한 수직 상승량. 위성뷰 투영 보정과 시뮬레이션 API 각도 변환 두 곳에서 쓰인다.
resource: src/app/page.tsx
tags: [domain, japan, geometry, units]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: page
    resource: src/app/page.tsx
    title: SUN_TO_DEGREE 매핑 / sunToDegree
  - id: placement
    resource: src/app/utils/panelPlacement.ts
    title: cosSlope 투영 보정
  - id: lnb-design
    resource: src/app/components/lnb/lnb-design.tsx
    title: SLOPE_OPTIONS — 선택 가능한 5단계
---

# 단위

寸(sun)은 **수평 10 에 대한 수직 상승량**이다. 4寸 지붕 = 수평 10 갈 때 4 올라가는 지붕.
따라서 경사각 θ = `atan(寸 / 10)`.

# 선택지는 5개뿐

`lnb-design.tsx` 의 `SLOPE_OPTIONS` — 1 / 3 / 4 / 6 / 8寸. 각각 일본어 설명 라벨이 붙는다
("標準屋根（約4寸）" = 표준 지붕). **초기값은 미선택(`null`)이며 선택 전에는 모듈 배치를 할 수 없다.**

# 용도 ① — 위성뷰 투영 보정

위성 평면뷰에서 경사면은 **처마에 수직인 방향으로만** `cos θ` 만큼 압축돼 보인다.
`panelPlacement.ts` 는 삼각비를 직접 쓰지 않고 대수적으로 계산한다:

```ts
const cosSlope = 10 / Math.sqrt(100 + slopeSun * slopeSun);  // = cos(atan(sun/10))
```

이 값이 모듈의 처마-수직 변 길이와 `gapY` 에 곱해진다. 처마-평행 변과 `gapX` 는 건드리지 않는다.
`slopeSun = 0` 이면 1 이 되어 보정이 사라진다.

# 용도 ② — 시뮬레이션 API 각도 변환

MUSBI 는 度(degree)를 받는다. 변환은 **계산식이 아니라 고정 룩업 테이블**이다 (`page.tsx` 의 `SUN_TO_DEGREE`):

| 寸 | 度 |
|----|-----|
| 1 | 5.71 |
| 3 | 16.7 |
| 4 | 21.8 |
| 6 | 30.96 |
| 8 | 38.66 |

API 팀 내부 사용값에 맞춘 것이라 `atan` 결과와 소수점 이하가 다를 수 있다 —
**임의로 계산식으로 바꾸면 안 된다.** 미매핑 값(미선택 `0` 포함)은 `0` 을 반환한다.

테이블에는 0.5寸 단위의 나머지 항목이 주석으로 보존되어 있다. 셀렉트박스가 5단계로 좁혀졌을 뿐,
선택지를 늘리려면 주석만 해제하면 된다.

# 관련

- 보정이 적용되는 축의 정의: [`eave-reference-edge.md`](eave-reference-edge.md)
- 시뮬레이션 파라미터 조립: [`workflows/simulation-flow.md`](/workflows/simulation-flow.md)
