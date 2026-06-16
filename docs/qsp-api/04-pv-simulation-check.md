# PV 발전시뮬레이션 결과전 검증 조회

발전 시뮬레이션 계산을 실행하기 전, 입력값(축전지 사용 여부 등)의 정합성을 사전 검증한다.

| 항목 | 값 |
|------|----|
| Method | `GET` |
| Endpoint | `/qm/pwrgnSimulation/checkCalcResults` |
| 설명 | PV 발전시뮬레이션 결과전 검증 조회 |

## Request Parameter

| Name | Type | Length | Not Nullable | 설명(JP) | 설명(EN) |
|------|------|--------|--------------|----------|----------|
| `pvSimulationYn` | string | 1 | **Y** | 太陽光発電シミュレーション状況 | PV Power Generation Simulation Status |
| `postCd` | string | 7 | **Y** | 郵便番号 | Zip Code |
| `moduleItemId` | string | 20 | **Y** | モジュール項目コード | Module Item Code |
| `moduleCnt` | int | | **Y** | モジュール数 | Number of Modules |
| `roofCnt` | int | | **Y** | 屋根面数 | Roof Surface |
| `roofLocCd` | float | | **Y** | 屋根方位角 | Roof Azimuth |
| `roofSlopeCd` | float | | **Y** | 屋根勾配 | Roof Slope |
| `avrgMnthElctBill` | int | | **Y** | 月平均使用量（円） | Monthly Average Usage (Yen) |
| `batteryItemId` | string | 20 | | バッテリー品目コード | Battery Item Code |
| `imgSrc` | string | 200 | | 屋根画像ファイル名 | Roof Image File Name |
| `storageBatteryYn` | string | 1 | | バッテリー使用状況 | Battery Usage Status |
| `storageBatterySelectYn` | string | 1 | | バッテリー選択状況 | Battery Selection Status |

## Response

| Name | Type | Length | Not Nullable | 설명(JP) | 설명(EN) |
|------|------|--------|--------------|----------|----------|
| `data` | object | | | データ | Data |
| `resultMessage` | string | 255 | | 結果メッセージ | Result Message |
| `resultCode` | int | 3 | | 結果コード — 成功 `200`, エラー `400` | Result Code (success : 200, error : 400) |

> 본 API는 검증 결과만 반환하므로 `data` 가 `null` 인 경우가 정상이다.

## Http Error

(엑셀 사양 미정의 — `resultCode` 400 으로 검증 실패 메시지가 내려온다)

## Response Example

성공 (검증 통과)

```json
{
  "data": null,
  "resultMessage": "OK",
  "resultCode": 200
}
```

실패 (검증 에러 — 축전지 사용 가부 불일치)

```json
{
  "data": null,
  "resultMessage": "バッテリーの使用可否が正常ではありません。",
  "resultCode": 400
}
```
