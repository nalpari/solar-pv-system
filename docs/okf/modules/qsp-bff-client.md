---
type: Module
title: QSP BFF Client
description: QSP/MUSBI 업스트림 호출을 한 함수(callQsp)로 모으고, 응답을 zod 로 검증해 공통 envelope 로 정규화한다.
resource: src/lib/qsp/client.ts
tags: [module, bff, upstream, zod]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: client
    resource: src/lib/qsp/client.ts
    title: callQsp / fetchBtcItems / postSimCheck / envelope 헬퍼
  - id: schema
    resource: src/lib/qsp/schema.ts
    title: zod 스키마 (SSOT)
  - id: qsp-api-docs
    resource: docs/qsp-api/README.md
    title: QSP.Connector.API 인터페이스 사양서
---

# 서버 전용

이 모듈은 라우트 핸들러에서만 import 된다. 업스트림 호스트가 환경변수로만 존재하고 클라이언트에 노출되지 않는다.

# `callQsp` 하나로 수렴

모든 업스트림 호출이 이 함수를 지난다. 단계는 고정이다:

```
호스트 미설정 확인 → URL+querystring 조립 → fetch(GET, no-store, 30s AbortController)
  → JSON 파싱 → zod 검증 → upstream result.code 확인 → 성공/실패 판별 유니온 반환
```

**업스트림은 두 API 모두 GET + querystring 이다.** BFF 라우트가 POST/JSON 으로 받더라도
여기서 querystring 으로 바꿔 GET 으로 호출한다 — `sim-check` 가 그 예다.

반환 타입은 판별 유니온이라 호출부에서 성공/실패를 분기하지 않을 수 없다:

```ts
type QspCallResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; code: number; message: string }
```

# 상태 코드 매핑

업스트림 `result.code` → 클라이언트 HTTP status:

| upstream code | → HTTP | 의미 |
|---------------|--------|------|
| 200 | 성공 | |
| 600 | 401 | 토큰 만료 |
| 400 | 422 | 검증 실패 |
| 그 외 | 502 | upstream 오류 |

전송 계층 실패도 구분한다 — 타임아웃(30초) → **504**, fetch 실패 → 502,
JSON 파싱 실패 → 502 `"Invalid upstream response"`, zod 위반 → 502 `"Upstream contract violation"`.

업스트림 응답의 `result` 표현이 두 가지(`{result:{code,message}}` / 평탄화 `{resultCode,resultMessage}`)라
`extractUpstreamStatus` 가 둘 다 받는다.

# 두 caller

**`fetchBtcItems`** — `GET /api/master/btcGoogleItemList?schItemTp=M|B`.
`data` 가 `null` 일 수 있으므로 `?? []` 로 빈 배열로 정규화한다. 응답은
`matlGbnCd` 기준 discriminated union(`BtcModule` | `BtcBattery`) — 같은 엔드포인트가 모듈과 축전지를 둘 다 반환한다.

**`postSimCheck`** — 검증 API 를 호출하고, 200 이면 **결과 페이지 리다이렉트 URL 을 조립해 돌려준다**.
이 API 는 값을 계산해주지 않는다. `roofImgSrc` 는 이 시점에 아직 없으므로 클라이언트가 업로드 후 붙인다.

```
redirectUrl = MUSBI_RESULT_HOST + MUSBI_RESULT_PATH + ?<입력 파라미터 전부>
```

`MUSBI_RESULT_HOST` 는 미설정 시 `MUSBI_API_HOST` 를 상속한다. `||` 를 쓴 이유는 빈 문자열도 폴백시켜
`new URL("")` 예외를 막기 위해서다.

# 라우트 공용 헬퍼

| 헬퍼 | 용도 |
|------|------|
| `envelopeSuccess(data)` | `{ success: true, data }` |
| `envelopeError(status, code, message)` | `{ success: false, error: { code, message } }` — **`proxy.ts` 와 detect-roof 도 이 포맷을 쓴다** |
| `formatZodError(err)` | issue 를 `"path message"` 로 이어 붙임 |
| `readJsonBodyWithLimit(req, maxBytes)` | `req.json()` 직접 호출 금지. arrayBuffer 로 읽어 byte cap 후 파싱 |

`readJsonBodyWithLimit` 이 존재하는 이유: `req.json()` 은 크기 제한이 없어 메모리/CPU 폭탄에 노출된다.

# 스키마가 SSOT

`schema.ts` 의 zod 정의가 **OpenAPI 문서의 원본**이기도 하다(`src/lib/openapi.ts` 가 `.meta({ id })` 로 컴포넌트 등록).
스키마를 고치면 검증과 문서가 함께 움직인다 — 문서를 따로 손대면 안 된다.
