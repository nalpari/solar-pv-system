---
type: API Endpoint
title: POST /api/musbi/sim-check
description: 발전 시뮬레이션 파라미터를 MUSBI 로 검증하고, 통과하면 결과 페이지 리다이렉트 URL 을 발급한다.
resource: src/app/api/musbi/sim-check/route.ts
tags: [api, bff, musbi, simulation]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: route
    resource: src/app/api/musbi/sim-check/route.ts
    title: 라우트 구현
  - id: client
    resource: src/lib/qsp/client.ts
    title: postSimCheck — redirectUrl 조립
  - id: spec-04
    resource: docs/qsp-api/04-pv-simulation-check.md
    title: 사양 04 — 검증
  - id: spec-05
    resource: docs/qsp-api/05-pv-simulation-calc.md
    title: 사양 05 — 결과 페이지
---

# 이 엔드포인트가 하는 일

**발전량을 계산하지 않는다.** 파라미터가 유효한지 MUSBI 에 물어보고, 통과하면
사용자를 보낼 **결과 페이지 URL 을 조립해 돌려줄 뿐**이다. 실제 계산과 화면은 MUSBI 쪽 페이지(`calcResults`)가 담당한다.

즉 05번 사양은 API 가 아니라 **페이지 리다이렉트**다. 이 구조 때문에 클라이언트는
검증 → 이미지 업로드 → `window.location.href` 이동의 3단계를 거친다
([`workflows/simulation-flow.md`](/workflows/simulation-flow.md)).

# 요청

```http
POST /api/musbi/sim-check
Content-Type: application/json
```

본문은 `SimulationInput`. 본문 상한 8KB (`readJsonBodyWithLimit`).

| 필드 | 타입 | 필수 | 비고 |
|------|------|------|------|
| `pvSimulationYn` | `"Y"` 리터럴 | ✅ | |
| `postCd` | string(1~10) | ✅ | **크롭 중심을 reverse geocode 해서 얻는다** — 주소 검색 결과를 재사용하지 않는다 |
| `moduleItemId` | string(1~20) | ✅ | btc-items 의 `matlCd` |
| `moduleCnt` | int ≥ 0 | ✅ | 배치된 모듈 수 |
| `roofCnt` | int ≥ 0 | ✅ | install 폴리곤 개수 |
| `roofLocCd` | number | ✅ | 방위 코드. 16방위 중 홀수 코드만 사용 (N=1, NE=3, E=5, SE=7, S=9, SW=11, W=13, NW=15) |
| `roofSlopeCd` | number | ✅ | 度. [寸→度 고정 매핑](/domain/roof-slope-sun.md) |
| `avrgMnthElctBill` | int ≥ 0 | ✅ | 월평균 전기요금 |
| `batteryItemId` | string(≤20) | | 축전지 미선택 시 `""` |
| `storageBatteryYn` / `storageBatterySelectYn` | `"Y"`\|`"N"` | | |
| `roofImgSrc` | string(≤200) | | **이 호출에는 넣지 않는다** — 이미지가 아직 없다 |

업스트림은 GET + querystring 이다. BFF 가 POST/JSON 을 받아 `callQsp` 에서 변환한다.

# 성공 응답

```json
{ "success": true, "data": { "redirectUrl": "https://.../qm/pwrgnSimulation/calcResults?..." } }
```

URL 은 `MUSBI_RESULT_HOST`(미설정 시 `MUSBI_API_HOST` 상속) + `MUSBI_RESULT_PATH` + 입력 파라미터 전부로 조립된다.
클라이언트가 여기에 `&roofImgSrc=<S3 키에서 pvmap/ 제거>` 를 덧붙여 이동한다.

# 오류

| status | 조건 |
|--------|------|
| 400 | 본문 오류 / zod 검증 실패 (필드별 메시지 포함) |
| 401 | 업스트림 code 600 |
| 413 | 본문 8KB 초과 |
| 422 | 업스트림 code 400 — **파라미터 조합이 MUSBI 정책에 맞지 않음** |
| 500 | `MUSBI_API_HOST` 미설정 |
| 502 / 504 | 업스트림 오류 / 30초 타임아웃 |

422 의 `message` 는 업스트림이 준 문구를 그대로 전달하며, 클라이언트는 이를 alert 으로 보여준다.
