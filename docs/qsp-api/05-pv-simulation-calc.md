# PV 발전시뮬레이션 결과 정보 조회

검증을 통과한 입력값으로 실제 발전 시뮬레이션을 실행하고 결과를 반환한다.

| 항목 | 값 |
|------|----|
| Method | `GET` |
| Endpoint | `/qm/pwrgnSimulationM/calcResults` |
| 설명 | PV 발전시뮬레이션 결과 정보 조회 |

## Request Parameter

엑셀 시트의 설명 컬럼이 [`04-pv-simulation-check.md`](./04-pv-simulation-check.md) 의 일본어 설명 대신 한국어/예시 값으로 작성되어 있는 점을 제외하면, 파라미터 자체는 검증 API와 동일하다.

| Name | Type | Length | Not Nullable | 설명(KO) | 비고 / 예시 |
|------|------|--------|--------------|----------|-------------|
| `pvSimulationYn` | string | 1 | **Y** | PV 발전시뮬레이션 여부 | 무조건 `Y` 로 셋팅 |
| `postCd` | string | 7 | **Y** | 우편번호 | ex) `106-0032` |
| `moduleItemId` | string | 20 | **Y** | 모듈 아이템코드 | ex) `106797` |
| `moduleCnt` | int | | **Y** | 모듈 매수 | ex) `8` |
| `roofCnt` | int | | **Y** | 지붕면수 | ex) `5` |
| `roofLocCd` | float | | **Y** | 지붕방위각 | ex) `0.0` |
| `roofSlopeCd` | float | | **Y** | 지붕경사각 | ex) `21.8` |
| `avrgMnthElctBill` | int | | **Y** | 월평균사용량(엔) | ex) `30000` |
| `batteryItemId` | string | 20 | | 축전지 아이템코드 | ex) `107039` (미선택 시 빈값) |
| `imgSrc` | string | 200 | | 지붕이미지파일명 | ex) `1.jpg` |
| `storageBatteryYn` | string | 1 | | 축전지 선택 여부 | 축전지 선택 시 `Y`, 그 외 `N` |
| `storageBatterySelectYn` | string | 1 | | (보조 플래그) | 축전지 선택 시 `Y`, 그 외 `N` |

## Response

엑셀 사양서의 응답 필드 표가 비어 있다 — 실제 응답 구조는 별도 확인 필요. 호출 예시 URL만 제공되어 있다.

## Http Error

(엑셀 사양 미정의 — 공통 에러 코드를 따른다)

## Request Example

축전지 선택

```
GET https://q-musubi-dev.q-cells.jp/qm/pwrgnSimulationM/calcResults
    ?pvSimulationYn=Y
    &postCd=340-9601
    &moduleItemId=106797
    &moduleCnt=8
    &roofCnt=5
    &roofLocCd=0.0
    &roofSlopeCd=21.8
    &avrgMnthElctBill=15000
    &batteryItemId=104426
    &storageBatteryYn=Y
    &storageBatterySelectYn=Y
```

축전지 미선택

```
GET https://q-musubi-dev.q-cells.jp/qm/pwrgnSimulationM/calcResults
    ?pvSimulationYn=Y
    &postCd=340-9601
    &moduleItemId=106797
    &moduleCnt=8
    &roofCnt=5
    &roofLocCd=0.0
    &roofSlopeCd=21.8
    &avrgMnthElctBill=15000
    &batteryItemId=
    &storageBatteryYn=N
    &storageBatterySelectYn=N
```
