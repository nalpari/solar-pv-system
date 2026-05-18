# Canvas 결과물 S3 업로드 설계

## 목적

캔버스(`CropPopup`)에서 합성된 최종 레이아웃 이미지를 특정 프로세스의 한 단계로서 **함수 호출 형태로 AWS S3에 업로드**한다. UI 버튼 트리거가 아니며, 호출 측(예: 다음 단계 진행, 자동 저장, 시뮬레이션 시작 직전 등)이 임의 시점에 함수를 호출해 결과 객체를 받는다.

## 비목표

- 업로드 전용 UI 버튼 추가 (기존 `Download` 버튼은 그대로 유지)
- S3 객체의 퍼블릭 공개 / CloudFront 배포 / 갤러리 화면
- 사용자 인증 / 권한 분리 (현재 앱에 로그인 없음)

## 아키텍처 — Presigned URL (A안)

```
Browser                         Next.js Route Handler              AWS S3
   │                                       │                          │
   │  ① POST /api/upload-url               │                          │
   │     { filename, contentType, size }   │                          │
   ├──────────────────────────────────────▶│                          │
   │                                       │  ② SDK: createPresigned  │
   │                                       │     PutObjectCommand     │
   │                                       ├─────────────────────────▶│
   │                                       │◀─────────────────────────┤
   │  ③ { uploadUrl, key, expiresIn }      │                          │
   │◀──────────────────────────────────────┤                          │
   │                                                                  │
   │  ④ PUT uploadUrl (binary PNG, Content-Type: image/png)           │
   ├─────────────────────────────────────────────────────────────────▶│
   │◀─────────────────────────────────────────────────────────────────┤
   │  ⑤ 200 OK + ETag                                                 │
```

- AWS 자격증명은 **서버 측 Route Handler 안에서만** 사용 (브라우저로 절대 노출 X)
- 클라이언트는 받은 URL로 PUT 한 번만 수행 → 서버 대역폭 0
- `.env` 의 키는 이미 준비되어 있음 (`AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` 등)

## 호출 API 설계

### 외부 노출 함수

```ts
// src/app/utils/canvasUpload.ts
export type CanvasUploadInput = {
  /** 합성 대상 메인 캔버스 (CropPopup의 overlay canvas) */
  canvas: HTMLCanvasElement;
  /** 배경 이미지 (없으면 canvas만 사용) */
  backgroundImage?: HTMLImageElement;
  /** S3 key 생성에 사용할 메타데이터 */
  meta?: {
    address?: string;
    /** 추가 prefix가 필요한 경우 (e.g. "simulation-input/") */
    prefix?: string;
  };
};

export type CanvasUploadResult = {
  key: string;            // S3 object key
  bucket: string;
  size: number;           // bytes
  contentType: "image/png";
  uploadedAt: string;     // ISO8601
};

export async function uploadCanvasToS3(
  input: CanvasUploadInput
): Promise<CanvasUploadResult>;
```

### 동작 순서

1. `backgroundImage` + `canvas`를 동일 크기의 임시 캔버스에 합성 (기존 `handleSave` 로직 재사용)
2. `HTMLCanvasElement.toBlob(..., "image/png")` 로 `Blob` 생성 (`toDataURL` 대신 메모리 효율 ↑)
3. `POST /api/upload-url` 호출 → `{ uploadUrl, key }` 수신
4. `fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/png" } })`
5. 응답 OK 확인 → `CanvasUploadResult` 반환
6. 실패 시 명확한 에러 throw (호출 측이 try/catch 로 처리)

### 호출 예시 (개념)

```ts
// 예: 시뮬레이션으로 넘어가기 직전 자동 저장
async function switchToSimulation() {
  if (canvasRef.current) {
    const result = await uploadCanvasToS3({
      canvas: canvasRef.current,
      backgroundImage: imgRef.current ?? undefined,
      meta: { address: cropData.address, prefix: "layouts/" },
    });
    // result.key 를 시뮬레이션 입력으로 전달하거나 상태에 저장
  }
  setActiveTab("simulation");
}
```

호출 위치는 **본 문서 범위가 아님** — 함수만 제공하고, 어디서 호출할지는 후속 작업에서 결정.

## 서버 라우트 설계

### `src/app/api/upload-url/route.ts`

- 메서드: `POST`
- 요청 바디:
  ```ts
  { filename: string; contentType: "image/png"; size?: number; prefix?: string }
  ```
- 응답:
  ```ts
  { uploadUrl: string; key: string; bucket: string; expiresIn: number }
  ```
- 내부 처리:
  1. 입력 검증 (`contentType === "image/png"`, `size ≤ MAX_SIZE` (예: 20MB))
  2. S3 key 생성: `${prefix ?? "layouts/"}${YYYY}/${MM}/${DD}/${slug}_${timestamp}_${shortUuid}.png`
  3. `getSignedUrl(s3Client, new PutObjectCommand({ Bucket, Key, ContentType }), { expiresIn: 300 })`
  4. JSON 반환
- 에러 응답: `400` (검증 실패) / `500` (AWS 오류)
- `runtime = "nodejs"` 명시 (AWS SDK 호환)

### S3 키 규칙

```
layouts/2026/05/15/{addressSlug}_{20260515-153012}_{8charUuid}.png
```

- `addressSlug`: 한글/특수문자 제거 후 lowercase, 최대 40자
- 타임스탬프: 기존 `CropPopup.handleSave` 포맷 재사용 (`YYYYMMDD-HHmmss` 으로 dash 1개만 추가)
- `shortUuid`: `crypto.randomUUID().slice(0, 8)` — 동일 초내 충돌 방지

## 변경 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `src/app/api/upload-url/route.ts` | 신규 | Presigned PUT URL 발급 Route Handler |
| `src/app/utils/canvasUpload.ts` | 신규 | `uploadCanvasToS3` 클라이언트 헬퍼 + blob 합성 |
| `src/app/utils/s3Key.ts` | 신규 | key 생성 / slug 정규화 유틸 (서버에서 사용) |
| `src/app/types/index.ts` | 수정 | `CanvasUploadInput`, `CanvasUploadResult` 타입 추가 |
| `package.json` | 수정 | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` 의존성 추가 |
| `CLAUDE.md` / `README.md` | 수정 | 신규 env 키, 의존성, 모듈 설명 갱신 |

`CropPopup.tsx` 자체는 **건드리지 않는다** (기존 다운로드 버튼 그대로). 함수가 외부에 노출되어 있으면 호출 측이 알아서 사용.

## 환경 변수

`.env` (서버 전용, `NEXT_PUBLIC_` 절대 금지):

| 변수 | 용도 |
|---|---|
| `AWS_REGION` | S3 클라이언트 region |
| `AWS_S3_BUCKET` | 업로드 대상 버킷 |
| `AWS_ACCESS_KEY_ID` | IAM 사용자 키 (dev) |
| `AWS_SECRET_ACCESS_KEY` | IAM 사용자 시크릿 (dev) |

운영 배포 시: IAM Role / 환경별 시크릿 매니저 사용 권장 (본 PR 범위 외).

## 보안 / 운영 고려

- **presigned URL TTL**: 300초 (5분) — 발급 후 즉시 PUT 하므로 충분
- **Content-Type 강제**: 라우트에서 `image/png` 외 거부, presigned URL 도 `ContentType` 시그니처에 포함되어 다른 타입으로 못 올림
- **파일 크기 상한**: 라우트에서 `size` 받아 검증 (20MB) + presigned URL 에 `ContentLength` 시그니처 포함 검토
- **S3 버킷 CORS**: PUT, `Content-Type` 헤더, app origin 허용 (배포 도메인 별로 화이트리스트)
- **버킷 퍼블릭 차단**: 유지. 읽기가 필요해지면 별도 presigned GET 으로 처리
- **로깅**: 라우트에서 `key` 와 발급 시각만 console.info, 자격증명/URL 자체는 로깅 X
- **rate limit**: 본 PR 범위 외 (필요해지면 미들웨어 도입)

## 에러 처리

| 단계 | 실패 시 동작 |
|---|---|
| `toBlob` 결과 null | `throw new Error("CANVAS_BLOB_FAILED")` |
| `/api/upload-url` non-200 | `throw new Error("PRESIGN_FAILED: <status>")` |
| S3 PUT non-2xx | `throw new Error("S3_UPLOAD_FAILED: <status>")` |
| 네트워크 예외 | 원본 에러 rethrow (호출 측이 메시지 노출 결정) |

retry / fallback 은 함수 외부 책임. 함수는 1회 시도 후 결과만 반환.

## 검증

1. `pnpm lint` / `npx tsc --noEmit` / `pnpm build` 통과
2. dev 서버에서 `uploadCanvasToS3` 를 임시 테스트 훅(콘솔)에서 호출 → S3 콘솔에 객체 확인
3. CORS preflight 확인 (브라우저 devtools network 탭)
4. 잘못된 contentType 으로 라우트 호출 시 400 응답 확인
5. 큰 캔버스(예: 4000×4000) 업로드 시 메모리/시간 확인
6. `.env` 키 비어있을 때 라우트가 500 + 명확한 메시지 반환 확인

## 작업 순서

1. 의존성 설치 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
2. `s3Key.ts` 유틸 작성 + 단위 검증 (콘솔)
3. `route.ts` 작성 + curl 로 presigned URL 발급 동작 확인
4. `canvasUpload.ts` 작성 + dev 콘솔에서 함수 직접 호출해 end-to-end 확인
5. 타입 노출 / CLAUDE.md / README.md 업데이트
6. 호출 측 통합은 별도 PR (어디서 호출할지 결정 후)

## 후속 작업 (본 PR 범위 외)

- 호출 측 통합 위치 결정 (시뮬레이션 진입 시 / 결과 확정 시 / 명시적 트리거)
- 업로드된 객체 목록 조회 UI
- presigned GET URL 발급 라우트 (이미지 미리보기용)
- 인증/세션 기반 권한 분리
