# QSP.Connector.API 사양서

일본법인 **QSP / Q.CAST** 의 발전 시뮬레이션 관련 외부 연동 API 사양 정리.

> 출처: `QSP.Connector.API 인터페이스 사양서.xlsx`
> 본 문서는 엑셀 사양서의 QSP 관련 시트(BTC / PV 발전시뮬레이션)만 추출·정리한 것이다.
> 엑셀에는 별도 프로젝트(미세먼지, 회원가입, 허브레터, 마음교감 등 한국어 관광·시설물 앱)의 시트도 포함되어 있으나, 본 폴더 범위에서는 다루지 않는다.

## API 목록

| No | API | Method | Endpoint | Source → Target | 문서 |
|----|-----|--------|----------|------------------|------|
| 3 | BTC Google Map 아이템 정보 조회 | GET | `/api/api/master/btcGoogleItemList` | Q.Partner → QSP | [03-btc-google-item-list.md](./03-btc-google-item-list.md) |
| 4 | PV 발전시뮬레이션 결과전 검증 조회 | GET | `/qm/pwrgnSimulationM/checkCalcResults` | (QSP 내부) | [04-pv-simulation-check.md](./04-pv-simulation-check.md) |
| 5 | PV 발전시뮬레이션 결과 정보 조회 | GET | `/qm/pwrgnSimulationM/calcResults` | (QSP 내부) | [05-pv-simulation-calc.md](./05-pv-simulation-calc.md) |

> 번호는 원본 엑셀 사양서의 시트 순서를 따른다. Design 계열(1·2번) 시트는 본 폴더에서 다루지 않으므로 3번부터 시작한다.

## 공통 응답 포맷

모든 API의 응답은 아래 구조를 따른다.

```json
{
  "data": {
    "content": { /* API별 응답 본문 */ }
  },
  "result": {
    "code": 200,
    "message": ""
  }
}
```

### 페이징 응답

페이징이 적용된 API는 `pageable` 블록이 추가된다.

```json
{
  "data": {
    "pageable": {
      "pg": 1,
      "pageSize": 10,
      "totalCount": 5
    },
    "content": { }
  },
  "result": {
    "code": 200,
    "message": ""
  }
}
```

### result 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `code` | int | 결과 코드. **200 = 성공**, 그 외는 모두 에러 |
| `message` | string | 결과 메시지 |

BTC 계열 응답에서는 `result` 객체에 다음 필드가 추가로 포함된다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `resultCode` | string(1) | 결과 코드2 — 성공 `S` / 에러 `E` |
| `resultMsg` | string(255) | 결과 메시지2 |

## 요청 메서드 규칙

| 메서드 | 규칙 |
|--------|------|
| GET | Query string 전달 |
| POST | Request Body에 JSON 형태로 전달 (`{"name":"이름"}`) |
| PUT | Request Body에 JSON 형태로 전달 |
| DELETE | Request Body에 JSON 형태로 전달 |

## 공통 에러 코드

| HTTP | code | 설명 |
|------|------|------|
| — | 200 | success |
| — | 600 | 토큰 유효기간을 초과하였습니다. 다시 로그인해주세요 |

```json
{
  "result": {
    "code": 600,
    "message": "토큰 유효기간을 초과하였습니다. 다시 로그인해주세요"
  }
}
```

> 엑셀의 「공통에러코드」 시트에는 위 두 코드만 정의되어 있다. 개별 API 시트의 `Http Error` 섹션은 대부분 비어 있다.

## 환경 정보

엑셀의 「기본정보」 시트에는 운영 서버 URL과 계정 정보 칸이 비어 있다. 「PV 발전시뮬레이션 결과 정보 조회」 예제에 등장하는 호스트는 다음과 같다.

- 개발: `https://q-musubi-dev.q-cells.jp`

## 용어 / 약어

| 용어 | 의미 |
|------|------|
| QSP | 한화큐셀 Q.CAST 일본법인의 발전 시뮬레이션 시스템 |
| Q.Partner | QSP 외부 파트너 시스템 (BTC 데이터 송신측) |
| 物件(ぶっけん) / Object | 발전 시뮬레이션 대상 부동산(건물) 단위 |
| Plan | 한 물건에 대한 견적안 (planNo 로 구분) |
| Module | 태양광 패널 모듈 |
| Battery / 蓄電池 | 가정용 축전지 |
| BTC | (사양서상 명시는 없으나) Google Map 자재 마스터 아이템 카테고리 |
