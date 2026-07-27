---
type: Metric
title: Installation Capacity (설치 용량)
description: 배치된 모듈 수 × 모듈 출력(W) ÷ 1000 으로 산출하는 kW 용량. 사이드바에 표시되는 유일한 파생 수치다.
resource: src/app/components/lnb/lnb-design.tsx
tags: [domain, metric, capacity]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: lnb-design
    resource: src/app/components/lnb/lnb-design.tsx
    title: totalKw 계산 및 모듈 목록 필터
  - id: qsp-schema
    resource: src/lib/qsp/schema.ts
    title: BtcModule.wpOut
---

# 정의

```
설치 용량(kW) = 배치된 모듈 수 × PanelSize.watt / 1000
```

`lnb-design.tsx` 는 부동소수 꼬리를 정리해 표시한다:

```ts
const totalKw = parseFloat(((panelCount * (panelSize?.watt ?? 0)) / 1000).toFixed(3));
```

# 입력의 출처

- **모듈 수** — `page.tsx` 의 `panelCount = placedPixelPanels.length || placedPanelsList.length`.
  픽셀 경로가 있으면 그쪽, 없으면 lat/lng 경로. 두 경로가 동시에 값을 갖는 일은 없다.
- **모듈 출력** — `PanelSize.watt`. QSP [btc-items](/interfaces/qsp-btc-items.md) 응답의 `wpOut`(문자열)을
  `Number()` 로 변환해 채운다.

# 데이터 위생 규칙

`wpOut` 이 없거나 0 인 모듈은 **선택지에서 제외**된다:

```ts
.filter((item) => item.matlGbnCd === "M" && Number(item.wpOut) > 0)
```

용량이 0 kW 로 잘못 표시되는 것을 막기 위한 것이다. 즉 마스터에 출력값이 비어 있는 모듈은 이 앱에서 아예 고를 수 없다 —
"모듈 목록에 있어야 할 제품이 안 보인다"는 문의의 첫 번째 확인 지점.

# 치수 매핑

같은 응답에서 물리 치수도 가져온다. 축 이름이 바뀌는 지점이라 주의:

| QSP 필드 | `PanelSize` 필드 | 단위 |
|----------|------------------|------|
| `shortAxis` | `width` | mm |
| `longAxis` | `height` | mm |

배치 시 landscape 고정이므로 실제 격자에서는 `height`(= 긴 축)가 처마와 평행한 변이 된다.
[`module-layout-rules.md`](module-layout-rules.md) 참조.

# 경계

이 값은 **표시 전용**이다. 발전 시뮬레이션에는 kW 가 아니라 `moduleCnt`(장수)와 `moduleItemId`(모듈 코드)가 넘어가고,
발전량은 MUSBI 가 자체 계산한다. 이 앱은 발전량을 산출하지 않는다.
