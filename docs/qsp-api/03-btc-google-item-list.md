# BTC Google Map 아이템 정보 조회

Q.Partner가 보유한 자재 마스터(모듈/축전지) 목록을 QSP에 제공한다.

| 항목 | 값 |
|------|----|
| Method | `GET` |
| Endpoint | `/api/master/btcGoogleItemList` |
| Source → Target | Q.Partner → QSP |
| Worker | 이정표 |
| 설명 | BTC Google Map 아이템 정보 조회 |

## Request Parameter

| Name | Type | Length | Not Nullable | 설명 |
|------|------|--------|--------------|------|
| `schItemTp` | string | 1 | | Item Type. `M` = Module, `B` = Battery |

## Response

| Name | Type | Length | Not Nullable | 설명(JP) | 설명(EN) |
|------|------|--------|--------------|----------|----------|
| `data` | list | | | データ | Data |
| └ `matlCd` | string | 20 | | 資材番号 | Material Number |
| └ `matlGbnCd` | string | 1 | | 資材区分コード | Material Gubun Code (`M`:Module, `B`:Battery) |
| └ `wpOut` | string | 5 | | 出力 | Output |
| └ `qcastCustPrdId` | string | 20 | | カスタマー製品ID | Customer Product ID |
| └ `qcastCustPrdNm` | string | 500 | | 顧客製品名 | Customer Product Name |
| └ `basicMatl` | string | 40 | | 基本資材 | Basic Material |
| └ `matlDesc` | string | 40 | | 資材説明 | Material Description |
| └ `longAxis` | double | | | 長辺 mm | Long Axis (mm) |
| └ `shortAxis` | double | | | 短辺 mm | Short Axis (mm) |
| └ `thickness` | double | | | 厚さ | Thickness |
| `result` | object | | **Y** | 結果 | Result Data |
| └ `code` | int | 3 | **Y** | 結果コード — 成功 `200`, エラー `400` |
| └ `message` | string | 255 | **Y** | 結果メッセージ |
| └ `resultCode` | string | 1 | **Y** | 結果コード2 — 成功 `S`, エラー `E` |
| └ `resultMsg` | string | 255 | N | 結果メッセージ2 |

### 필드 메모

- `longAxis` / `shortAxis` / `thickness`: Module(`matlGbnCd = M`) 일 때만 채워지며, Battery 의 경우 `null` 이다.
- `wpOut`: Module의 출력값(예: `"445"`). Battery 의 경우 `null`.
- `qcastCustPrdId` 와 `matlCd` 는 예제상 동일 값이지만, 사양상 별도 필드로 정의되어 있다.

## Http Error

(엑셀 사양 미정의 — 공통 에러 코드를 따른다)

## Response Example

```json
{
  "code": null,
  "data": [
    {
      "matlCd": "107815",
      "matlGbnCd": "M",
      "wpOut": "445",
      "qcastCustPrdId": "107815",
      "qcastCustPrdNm": "【限定販売店】Re.RISE-NT1 445",
      "basicMatl": "Re.RISE-NT1 445",
      "matlDesc": "Re.RISE-NT1 445",
      "longAxis": 1722.0,
      "shortAxis": 1134.0,
      "thickness": 30.0
    },
    {
      "matlCd": "105728",
      "matlGbnCd": "B",
      "wpOut": null,
      "qcastCustPrdId": "105728",
      "qcastCustPrdNm": "5Kwh蓄電池(10年保証)",
      "basicMatl": "LUNA2000-5-NHE0",
      "matlDesc": "(Spot)LUNA2000-5-NHE0 5Kwh蓄電池(10年保証)",
      "longAxis": null,
      "shortAxis": null,
      "thickness": null
    },
    {
      "matlCd": "104244",
      "matlGbnCd": "B",
      "wpOut": null,
      "qcastCustPrdId": "104244",
      "qcastCustPrdNm": "受注発注品 蓄電池ﾕﾆｯﾄ",
      "basicMatl": "BX_6.0",
      "matlDesc": "（Spot扱い）受注発注品 BX_6.0 蓄電池ﾕﾆｯﾄ",
      "longAxis": null,
      "shortAxis": null,
      "thickness": null
    },
    {
      "matlCd": "104426",
      "matlGbnCd": "B",
      "wpOut": null,
      "qcastCustPrdId": "104426",
      "qcastCustPrdNm": "受注発注品 PKG-EHD-S55MP3B EIBS蓄電池システム",
      "basicMatl": "PKG-EHD-S55MP3B",
      "matlDesc": "受注発注品 PKG-EHD-S55MP3B EIBS蓄電池システム",
      "longAxis": null,
      "shortAxis": null,
      "thickness": null
    }
  ],
  "data2": null,
  "result": {
    "code": 200,
    "resultCode": "S",
    "message": "success",
    "resultMsg": ""
  }
}
```

> 예제에는 사양에 정의되지 않은 루트 필드 `code: null`, `data2: null` 이 함께 내려온다 — 클라이언트는 무시 가능.
