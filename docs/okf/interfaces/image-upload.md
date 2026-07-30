---
type: API Endpoint
title: POST /api/image/upload
description: 합성 레이아웃 이미지(배경 + 모듈 오버레이)를 S3 의 pvmap/ 프리픽스에 UUID 키로 저장한다.
resource: src/app/api/image/upload/route.ts
tags: [api, s3, upload]
generated: { by: claude-code/opus-5, at: 2026-07-27T04:26:32Z }
status: stable
sources:
  - id: route
    resource: src/app/api/image/upload/route.ts
    title: 라우트 구현
  - id: schema
    resource: src/lib/image/schema.ts
    title: ALLOWED_IMAGE_TYPES / UploadImageResultSchema
---

# 요청

`multipart/form-data`, 필드명 `file`.

| 제약 | 값 |
|------|-----|
| 허용 MIME | `image/png`, `image/jpeg`, `image/webp`, `image/bmp`, `image/gif` |
| 최대 크기 | 10 MB |
| `Content-Length` | **필수** — 없거나 무효면 413 |

`Content-Length` 를 먼저 보는 이유: `formData()` 파싱 후 `file.size` 를 보면 이미 메모리를 다 쓴 뒤다.
헤더로 1차 차단하고 파싱 후 `file.size` 로 정밀 재검증한다. chunked 전송은 크기를 알 수 없어 거부되는데,
우리 클라이언트는 브라우저 `fetch` 라 항상 헤더를 보낸다.

# 키 생성

```
pvmap/{crypto.randomUUID()}.{png|jpg|webp|bmp|gif}
```

확장자는 **클라이언트가 준 파일명이 아니라 검증된 MIME 에서 유도**한다. UUID 이므로 덮어쓰기·충돌이 없고,
사용자 제공 문자열이 키에 들어가지 않아 path traversal 여지가 없다.

# 응답

```json
{ "success": true, "data": {
    "filePath": "https://<NEXT_PUBLIC_AWS_S3_BASE_URL>/pvmap/<uuid>.png",
    "fileName": "pvmap/<uuid>.png"
} }
```

- `filePath` — 공개 URL (표시용)
- `fileName` — S3 오브젝트 키. 클라이언트가 `pvmap/` 프리픽스를 떼고 `roofImgSrc` 로 넘긴다

# 오류

| status | 조건 |
|--------|------|
| 400 | multipart 파싱 실패 / `file` 필드 없음 / 허용되지 않은 MIME / 빈 파일 |
| 413 | `Content-Length` 누락·무효 / 10MB 초과 |
| 500 | S3 환경변수 미설정 (`AMPLIFY_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_AWS_S3_BASE_URL`) |
| 502 | S3 `PutObject` 실패 |

누락 환경변수의 이름은 **서버 로그에만** 남고 클라이언트에는 일반 메시지가 간다.

# 클라이언트 재시도 정책

`page.tsx` 의 `uploadLayoutImage()`:

- 캔버스가 없어 Blob 이 `null` 이면 **재시도하지 않는다** (재시도해도 결과가 같다)
- **4xx 는 즉시 중단** — 빈 파일·크기 초과 같은 결정적 실패다
- 그 외 실패는 최대 3회, 지수 백오프(500ms → 1000ms)
- 3회 다 실패하면 결과조회 전체를 중단하고 alert

# 수명

업로드된 객체를 정리하는 로직이 없다. 결과조회를 시도할 때마다 새 UUID 객체가 쌓이며,
검증은 통과했지만 사용자가 결과 페이지를 떠난 경우에도 남는다. **버킷 라이프사이클 정책이 필요하다.**
