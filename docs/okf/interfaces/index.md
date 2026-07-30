# Interfaces

앱이 노출하는 HTTP 엔드포인트. 전부 `runtime = "nodejs"` 이고,
`/api/openapi` 와 `/reference` 를 제외한 모든 라우트가 [보안 경계](/system/security-perimeter.md) 뒤에 있다.

* [POST /api/detect-roof](detect-roof.md) - 크롭 이미지에서 지붕면 폴리곤 자동 감지.
* [GET /api/qsp/btc-items](qsp-btc-items.md) - 모듈(`M`) / 축전지(`B`) 마스터 조회.
* [POST /api/musbi/sim-check](musbi-sim-check.md) - 발전 시뮬레이션 파라미터 검증 + 결과 페이지 URL 발급.
* [POST /api/image/upload](image-upload.md) - 합성 레이아웃 이미지를 S3 에 저장.

# 응답 규약

성공은 `{ success: true, data }`, 실패는 `{ success: false, error: { code, message } }` 로 통일한다
(`envelopeSuccess` / `envelopeError`, [`modules/qsp-bff-client.md`](/modules/qsp-bff-client.md)).

⚠️ **예외 하나** — `detect-roof` 의 **성공** 응답은 envelope 로 감싸지 않고
`{ polygons, reason }` 을 그대로 반환한다. 실패만 envelope 를 쓴다.

# API 문서 엔드포인트

`ENABLE_API_DOCS === "true"` 인 환경에서만 노출되고 그 외에는 **404** 다 (내부 명세 노출 차단).
`NODE_ENV` 가드를 쓰지 않는 이유는 dev/prod 양쪽 다 production 빌드를 쓰기 때문.

| 경로 | 내용 |
|------|------|
| `GET /api/openapi` | zod 스키마에서 생성한 OpenAPI 3.1 JSON. 모듈 스코프 lazy memoize |
| `GET /reference` | Scalar 기반 API Reference UI. 위 엔드포인트를 소비 |

빌더는 `src/lib/openapi.ts` — `createDocument({ reused: "ref" })` 로 `.meta({ id })` 가 붙은 zod 스키마를
`components.schemas` 에 자동 등록하고 paths 에서 `$ref` 로 참조한다. **문서를 손으로 쓰지 않는다.**
