---
type: Workflow
title: Simulation Flow
description: 방위·축전지·전기요금 입력 → 우편번호 역지오코딩 → 파라미터 검증 → 이미지 업로드 → MUSBI 결과 페이지로 이탈.
resource: src/app/page.tsx
tags: [workflow, simulation, musbi]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: page
    resource: src/app/page.tsx
    title: handleSimSubmit / buildSimulationInput
  - id: lnb-sim
    resource: src/app/components/lnb/lnb-sim.tsx
    title: 시뮬레이션 탭 입력 폼
---

# 입력

시뮬레이션 탭(`LnbSim`)이 모으는 것은 셋뿐이다.

| 입력 | 상태 | 비고 |
|------|------|------|
| 방위 | `azimuth` | 8방위. 나침반 UI + 셀렉트 |
| 축전지 | `hasBattery` / `batteryModel` | 기본 `hasBattery: true`. btc-items `schItemTp=B` 로 목록 조회 |
| 월평균 전기요금 | `monthlyElecCost` | |

나머지 파라미터는 디자인 탭 상태에서 끌어온다 — 모듈 코드·장수·지붕면 수·경사.

**제출 버튼(`canSubmitSim`)** 조건: `moduleId` 있음 ∧ 경사 선택됨 ∧ 모듈 수 > 0 ∧ install 면 ≥ 1
∧ 방위 선택됨 ∧ 요금 입력됨 ∧ (축전지 미사용 ∨ 축전지 모델 선택됨).
`postCd` 는 여기 없다 — 제출 시점에 구한다.

# 제출 — 3단계 (`handleSimSubmit`)

```
① 우편번호 확보    google.maps.Geocoder().geocode({ location: center })
                   → extractPostalCode(address_components)
                   실패/빈값 → alert 후 중단

② 파라미터 검증    POST /api/musbi/sim-check
                   실패 → 업스트림 메시지 alert 후 중단
                   성공 → data.redirectUrl 확보

③ 이미지 업로드    CropPopup.getLayoutBlob() → POST /api/image/upload
                   4xx 즉시중단 / 그 외 3회 재시도(지수 백오프)
                   실패 → alert 후 중단

④ 이탈            window.location.href = redirectUrl + "&roofImgSrc=" + fileName(pvmap/ 제거)
```

`isSubmitting` 이 중복 클릭을 막고 전체화면 로딩 오버레이를 띄운다.
성공하면 페이지를 떠나므로 오버레이를 내리지 않는다 — 중단 경로에서만 `setIsSubmitting(false)` 를 호출한다.

# 왜 우편번호를 다시 구하는가

주소 검색 결과의 우편번호를 재사용하지 않는다. **사용자가 검색 후 지도를 옮겨 다른 건물을 크롭할 수 있기 때문**이다.
항상 최종 크롭 중심을 reverse geocode 해야 위치와 우편번호가 일치한다.

# 왜 검증이 업로드보다 먼저인가

파라미터가 틀리면 S3 에 쓸 이유가 없다. 순서를 바꾸면 검증 실패마다 고아 객체가 쌓인다.
반대로 현재 순서에서도 **③ 이후 사용자가 결과 페이지를 떠나면 객체는 남는다** —
정리 로직이 없으므로 버킷 라이프사이클이 필요하다([`interfaces/image-upload.md`](/interfaces/image-upload.md)).

# 파라미터 매핑 (`buildSimulationInput`)

| UI | → `SimulationInput` | 변환 |
|----|---------------------|------|
| `azimuth` (`"S"` 등) | `roofLocCd` | `ROOF_LOC_CD` — 16방위 중 홀수 코드. 미매핑 → `0` |
| `slope` (寸) | `roofSlopeCd` | `SUN_TO_DEGREE` 고정 룩업. 미매핑 → `0` ([근거](/domain/roof-slope-sun.md)) |
| `panelCount` | `moduleCnt` | |
| `installAreas.length` | `roofCnt` | |
| `monthlyElecCost` | `avrgMnthElctBill` | `Number(...) \|\| 0` |
| `hasBattery` | `storageBatteryYn` / `storageBatterySelectYn` / `batteryItemId` | 미사용 시 `"N"` + `""` |

⚠️ 두 매핑 모두 **미매핑 값을 `0` 으로 조용히 떨어뜨린다**. 방위나 경사가 예상 밖 값이면
검증 오류가 아니라 "0" 으로 계산될 수 있다 — 새 방위·경사 선택지를 추가하면 매핑 테이블도 함께 늘려야 한다.

# 되돌아가기

"모듈 편집으로 돌아가기"는 `simForm` 이 기본값에서 바뀌었을 때만 확인 창을 띄운다.
비교는 `DEFAULT_SIM_FORM` 키를 순회하는 shallow-equal 이라 **기본값을 바꿔도 판정이 자동으로 따라온다**.
승인 시 `simForm` 초기화 + 탭 design + `isPlacementDone` 해제.
