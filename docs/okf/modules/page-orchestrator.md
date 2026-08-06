---
type: Module
title: Page Orchestrator (Home)
description: 앱의 모든 상태를 혼자 소유하고 자식에게 props 로 내려주는 855줄짜리 클라이언트 컴포넌트.
resource: src/app/page.tsx
tags: [module, state, react, god-node]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: page
    resource: src/app/page.tsx
    title: Home 컴포넌트
  - id: graph
    resource: graphify-out/GRAPH_REPORT.md
    title: 지식 그래프 — Home 이 20 edge 로 최다 연결
---

# 책임

상태 소유 하나다. 서버 컴포넌트도, context 도, 상태 라이브러리도 없다 — 30개 남짓한 `useState` 가 전부 여기 있고
자식은 props 와 콜백으로만 소통한다(Props-Down / Callbacks-Up). 지식 그래프에서 가장 많이 연결된 노드다.

# 상태 그룹

| 그룹 | 대표 상태 |
|------|-----------|
| 지도 | `center`, `viewport`, `markerPosition`, `address`, `cropMode`, `cropData` |
| 지붕면 | `areas`(lat/lng), `pixelAreas`(픽셀), `selectedRoofIds`, `canMergeSelected`, `canUndoPoint` |
| 배치 | `slope`, `panelSize`, `moduleId`, `placedPanelsList`, `placedPixelPanels`, `placementError` |
| 흐름 | `activeTab`, `isPlacementDone`, `isSubmitting`, `detectStatus` |
| 시뮬 | `simForm` |

# 시그널 패턴

자식(`CropPopup`)에게 **명령**을 보낼 때 함수 대신 **증가하는 숫자**를 내려보낸다 —
`undoSignal`, `clearSignal`, `deleteSelectedSignal`, `mergeSelectedSignal`, `confirmCropSignal`.
자식은 `useEffect` 로 값 변화를 감지해 동작한다.

이유: 폴리곤의 진실은 `CropPopup` 내부 캔버스 state 에 있어서 부모가 직접 조작할 수 없다.
imperative handle 을 더 늘리는 대신 값 변경으로 명령을 표현한 것이다.
(예외적으로 `getLayoutBlob` 만 `useImperativeHandle` — 반환값이 필요해서다.)

# 초기화 규칙 (진실의 원천 단일화)

여러 경로에서 같은 초기화가 필요해 헬퍼로 모았다.

- `resetSlopeAndModule()` — 경사·모듈·moduleId 를 미선택으로. install 면이 0개가 될 때, 크롭을 닫을 때 호출.
- `handleDeleteAll()` — 폴리곤·모듈·툴 전부 초기화. **이 함수만은 인라인으로 같은 코드를 중복 보유한다** —
  `handleStartDetect` 가 hoisted function 인 이 함수를 참조하는데, `useCallback` 헬퍼를 부르면
  `handleStartDetect` 의 deps 연쇄가 생기기 때문. 의도된 중복이다.

# 레이스 가드

비동기가 겹치는 지점마다 가드가 있다.

| 지점 | 가드 |
|------|------|
| geolocation | `userOverrodeRef` — 사용자가 주소를 고른 뒤 늦게 도착한 위치 응답은 무시 |
| AI 감지 | `abortControllerRef` — 새 요청이 시작됐으면 이전 응답 폐기(`abortControllerRef.current !== controller`) |
| 크롭 센터 이동 | `requestAnimationFrame` — 팝업이 지도를 가린 다음 프레임에 `panTo`. 깜박임 방지. 언마운트 시 취소 |
| 결과조회 제출 | `isSubmitting` — 중복 클릭 차단 + 전체화면 로딩 오버레이 |

# 파생 값

상태로 두지 않고 매 렌더 계산한다 — `installAreas`, `excludeAreas`, `drawingMode`(툴에서 파생),
`panelCount`, `canPlace`, `canSubmitSim`. React Compiler 가 켜져 있어 수동 memo 를 붙이지 않는다.

# 배치 경로 분기

`handlePlacePanels` 는 `pixelAreas` 유무로 갈린다.

```
pixelAreas 있음 → placePanelsOnCanvasCm (cm 단위, 픽셀 좌표)   ← 실제 흐름
pixelAreas 없음 → placePanels (mm 단위, lat/lng)              ← 크롭 없이 지도 직접 편집용
```

크롭 팝업이 열려 있으면 항상 위쪽이다. 아래 경로는 현재 UI 에서 도달하기 어렵다.
자세한 규칙은 [`domain/module-layout-rules.md`](/domain/module-layout-rules.md).
