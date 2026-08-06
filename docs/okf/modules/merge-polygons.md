---
type: Module
title: Merge Polygons
description: 선택한 인접 지붕면들을 하나로 합친다. 버튼 활성 판정과 실제 병합이 같은 함수를 호출해 어긋날 수 없다.
resource: src/app/utils/mergePolygons.ts
tags: [module, geometry, polygon-clipping]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: merge
    resource: src/app/utils/mergePolygons.ts
    title: mergeAreaPolygons 구현 (221줄)
---

# 계약

```ts
mergeAreaPolygons(polys: PixelPoint[][]): PixelPoint[] | null
```

입력·출력 모두 캔버스 픽셀 좌표. 병합 불가면 `null`.

```ts
outerRings(polys: PixelPoint[][]): PixelPoint[][]
```

지붕 실루엣 조회용 — 면들을 union 해 **외곽 링만** 돌려준다 (구멍은 버린다). `CropPopup` 의 외곽 치수 표기가 쓴다.
`mergeAreaPolygons` 와 달리 인접 판정도 필러도 없다: 미세한 틈은 메우지 않고 링 두 개로 남는다.
치수는 보기용이라 "붙여도 되는가" 판정이 필요 없고, 병합 거부 조건을 표기에 끌어오면 떨어진 면의 치수가 통째로 사라진다.

**핵심 설계**: `CropPopup` 은 "지붕결합" 버튼의 활성 여부를 판정할 때도 이 함수를 그대로 호출한다.
판정 로직과 실행 로직이 하나이므로 "버튼은 켜지는데 눌러도 아무 일이 없다"가 구조적으로 불가능하다.
버튼 활성 조건을 바꾸고 싶다면 별도 판정 함수를 만들지 말고 이 함수를 고쳐야 한다.

# 판정 순서 (bridge-then-union)

0. **영면적 배제** — 정점이 모두 공선이라 면적 0 인 면이 하나라도 있으면 즉시 `null`.
   union 이 zero-area 지오메트리를 소거해 "떨어져 있는데 병합에 포함돼 조용히 삭제"되는 사고를 막고,
   `OVERLAP_RATIO × minArea` 임계가 0 이 되어 포개짐 판정이 무력화되는 것도 막는다.
1. **면 포개짐 배제** — 어떤 두 면이든 그 쌍의 작은 면 대비 `OVERLAP_RATIO`(5%)를 넘게 겹치면 거부.
   면을 끌다가 포개진 것은 "인접"이 아니다. **쌍 단위 판정**이라 무관한 면이 섞여도 다른 쌍의 판정이 흔들리지 않는다.
2. **필러 생성(bridge)** — `GAP_TOL`(3px) 이내로 근접하고 `MIN_OVERLAP`(10px) 이상 겹치는 변 쌍의 틈을
   얇은 사각형으로 메운다. AI 분할면의 미세 gap 과 회전을 흡수하는 단계다.
3. **union** — 원본 + 필러를 `polygon-clipping` 으로 합친다. 결과가 단일 폴리곤이 아니면(코너만 접촉·완전 분리) `null`.
4. **구멍 거부** — 결과에 hole(중정 등)이 있으면 `null`. 빈 공간을 메워 실재하지 않는 지붕을 만들지 않기 위함.
   `HOLE_MIN_AREA`(1.0) 미만의 미세 링은 수치 잔재로 보고 무시한다.
5. **톱니 단순화** — 미세 회전으로 생긴 준-공선 정점(수직편차 `SIMPLIFY_EPS` 0.5px 미만)을 제거.

# 상수

| 상수 | 값 | 의미 |
|------|-----|------|
| `GAP_TOL` | 3.0 px | 필러를 놓을 최대 틈 |
| `MIN_OVERLAP` | 10.0 px | 필러를 놓을 최소 겹침 길이 |
| `OVERLAP_RATIO` | 0.05 | 포개짐으로 판정할 면적 비율 |
| `SIMPLIFY_EPS` | 0.5 px | 공선 판정 수직편차 |
| `HOLE_MIN_AREA` | 1.0 px² | 무시할 미세 hole 면적 |

전부 **픽셀 단위**다 — 캔버스 해상도가 바뀌면 실질 허용 오차도 함께 바뀐다.

# 승계되지 않는 것

병합 결과는 새 폴리곤이다. `eaveEdgeIndex` 를 승계하지 않으므로
[처마 기준변](/domain/eave-reference-edge.md)은 폴백(가장 긴 변)에서 다시 시작한다.
병합 후에는 흐름 설정을 다시 확인하는 것이 안전하다.

# 이력

`4c7c4ab` — 필러 이음새의 잔재를 중정으로 오판해 병합이 거부되던 문제를 4단계의 `HOLE_MIN_AREA` 로 수정.
