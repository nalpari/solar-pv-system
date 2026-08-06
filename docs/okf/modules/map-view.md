---
type: Module
title: Map View
description: Google Maps 위성뷰와 드래그 크롭 오버레이. html2canvas 로 지도 타일을 캡처해 CropData 를 만든다.
resource: src/app/components/MapView.tsx
tags: [module, google-maps, capture, ui]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: mapview
    resource: src/app/components/MapView.tsx
    title: 구현 (562줄)
  - id: types
    resource: src/app/types/index.ts
    title: CropData / CropBounds
---

# 구성

`@vis.gl/react-google-maps` 의 `Map`(id `solar-pv-map`) 위에 세 개의 보조 컴포넌트가 얹힌다.

| 컴포넌트 | 역할 |
|----------|------|
| `ViewUpdater` | `viewport` 가 있으면 `fitBounds`, 없으면 `panTo(center)`. **첫 렌더는 건너뛴다**(초기 카메라 존중) |
| `WheelZoomController` | 휠 줌 기준점을 커서가 아닌 **지도 중심**으로 바꾼다. 델타를 누적해 임계치(50)에서 한 단계 |
| `CropOverlay` | 드래그로 사각형 영역을 그리고 리사이즈·이동. `hitTest` 로 8방향 핸들 판정 |

여기에 더해 `markerPosition`(주소 검색으로 선택된 좌표)이 있으면 `Marker` 를 하나 얹는다.
**크롭모드에서는 렌더하지 않는다** — `html2canvas` 가 지도 컨테이너를 통째로 캡처하므로
핀이 이미지에 박혀 [AI 감지](ai-roof-detection.md) 입력이 오염된다.

# 크롭 확정 — `handleConfirm`

핵심 산출물은 [`CropData`](/domain/roof-face.md) 하나다.

**① 픽셀 사각형 → 지리 bounds** — 지도 뷰포트 bounds 와 컨테이너 크기로 선형 보간한다.
Web Mercator 의 위도 비선형성을 무시한 근사다. 크롭 한 장(수십 m) 범위에서는 무해하지만
매우 높은 위도나 축소된 줌에서는 오차가 커진다.

**② 실측 크기** — `sizeMeters` 를 위경도 차이에서 직접 계산한다. `panelPlacement` 와 같은 상수(111320)를 쓴다.

```ts
heightMeters = latDiff * 111320
widthMeters  = lngDiff * 111320 * cos(avgLat)
```

이 값이 뒤에서 `metersPerPixel` 이 되어 [모듈 배치](panel-placement.md)의 축척을 결정한다 —
**크롭 크기 계산이 틀리면 배치 장수가 통째로 틀린다.**

**③ 타일 캡처** — `html2canvas(mapContainer, { scale: max(2, ceil(devicePixelRatio)) })`.
scale 을 최소 2 + 정수로 올리는 이유는 소수 배율에서 타일 경계에 1px 흰 줄이 생기기 때문이다.
캡처한 전체 캔버스에서 크롭 영역만 잘라 `toDataURL("image/png")`.

**④ 실패 폴백** — 캡처가 실패하면 회색 배경에 "Satellite Image" 와 좌표를 그린 플레이스홀더 캔버스를 반환한다.
**예외를 올리지 않으므로 흐름은 그대로 진행된다** — 사용자에게는 회색 이미지가 뜨고,
[AI 감지](ai-roof-detection.md)에 넘기면 당연히 지붕을 못 찾는다. "AI 분석이 항상 실패한다"의 유력한 원인.

# 2단 클릭 프로토콜

사이드바 "건물확정" 버튼은 두 번 눌린다.

```
1차 클릭 → cropMode = true          (오버레이 등장, 드래그로 영역 지정)
2차 클릭 → confirmCropSignal += 1   (MapView 가 영역이 있으면 확정)
```

부모가 확정 시점을 직접 호출하지 않고 시그널로 알리는 이유는 사각형의 진실이 `CropOverlay` 내부에 있기 때문이다.

# 잠금

`locked`(= `cropData !== null`)이면 지도 조작을 막는다. 크롭 팝업이 뜬 뒤 지도가 움직이면
이미 캡처한 이미지와 좌표계가 어긋나기 때문이다.
