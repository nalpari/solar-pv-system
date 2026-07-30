---
type: API Endpoint
title: GET /api/qsp/btc-items
description: QSP 마스터에서 태양광 모듈(M) 또는 축전지(B) 목록을 조회한다. 같은 엔드포인트가 두 종류를 반환한다.
resource: src/app/api/qsp/btc-items/route.ts
tags: [api, bff, qsp, master-data]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: route
    resource: src/app/api/qsp/btc-items/route.ts
    title: 라우트 구현
  - id: schema
    resource: src/lib/qsp/schema.ts
    title: BtcItemSchema — matlGbnCd 판별 유니온
  - id: spec
    resource: docs/qsp-api/03-btc-google-item-list.md
    title: 사양 03 — BTC Google Map 아이템 정보 조회
---

# 요청

```http
GET /api/qsp/btc-items?schItemTp=M
```

| 파라미터 | 값 | 필수 |
|----------|-----|------|
| `schItemTp` | `"M"`(모듈) \| `"B"`(축전지) | 선택 — 생략하면 업스트림 기본 동작 |

업스트림: `GET {QSP_API_HOST}/api/master/btcGoogleItemList`.

# 응답

```json
{ "success": true, "data": [ /* BtcItem[] */ ] }
```

`matlGbnCd` 로 판별되는 유니온이다. **두 변형의 필드 타입이 다르다** — 특히 치수:

| 필드 | `matlGbnCd: "M"` (모듈) | `matlGbnCd: "B"` (축전지) |
|------|------------------------|--------------------------|
| `wpOut` | `string` (출력 W) | `string \| null` |
| `longAxis` / `shortAxis` / `thickness` | `number` | `string \| null` |
| `matlCd` | 모듈 코드 (`moduleItemId` 로 사용) | 축전지 코드 (`batteryItemId` 로 사용) |
| `qcastCustPrdNm` | 표시명 | 표시명 |

업스트림 `data` 가 `null` 일 수 있어 `?? []` 로 정규화한다 — **빈 배열은 정상 응답이다**.
사양에 없는 root 필드(`code`, `data2`)는 zod strip 으로 자동 무시된다.

# 소비처

| 호출자 | 파라미터 | 용도 |
|--------|----------|------|
| `lnb-design.tsx` | `schItemTp=M` | 모듈 셀렉트. `wpOut > 0` 인 항목만 남기고 `shortAxis→width` / `longAxis→height` / `wpOut→watt` 로 매핑 |
| `lnb-sim.tsx` | `schItemTp=B` | 축전지 셀렉트 |

출력값이 없는 모듈이 목록에서 사라지는 규칙은 [`domain/installation-capacity.md`](/domain/installation-capacity.md) 참조.

# 오류

| status | 조건 |
|--------|------|
| 400 | `schItemTp` 가 `M`/`B` 가 아님 (zod) |
| 401 | 업스트림 code 600 — 토큰 만료 |
| 422 | 업스트림 code 400 — 검증 실패 |
| 500 | `QSP_API_HOST` 미설정 |
| 502 | fetch 실패 / JSON 파싱 실패 / **스키마 위반** / 그 외 업스트림 코드 |
| 504 | 업스트림 30초 타임아웃 |

업스트림이 사양과 다른 형태를 돌려주면 그대로 통과시키지 않고 **502 `"Upstream contract violation"`** 으로 막는다.
마스터 필드가 추가·변경되었는데 목록이 통째로 비어 보인다면 이 경로를 먼저 의심할 것 — 서버 로그에 위반 필드가 남는다.
