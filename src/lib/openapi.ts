// src/lib/openapi.ts
// 기존 zod 스키마로부터 OpenAPI 3.1 문서를 빌드한다.
// 검증 로직(src/lib/qsp/schema.ts, src/lib/detect/schema.ts)을 SSOT로 재사용.
import { z } from "zod";
import { createDocument } from "zod-openapi";
import {
  BtcItemSchema,
  BtcItemsInputSchema,
  SimulationInputSchema,
} from "./qsp/schema";
import {
  BboxResponseSchema,
  DetectResponseSchema,
  PolygonSchema,
} from "./detect/schema";
import { ALLOWED_IMAGE_TYPES, UploadImageResultSchema } from "./image/schema";

// ============================================================================
// 공통 envelope (BFF 응답 포맷)
//   성공: { success: true, data: T }
//   실패: { success: false, error: { code, message } }
// ============================================================================

const ErrorEnvelopeSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.number().int(),
      message: z.string(),
    }),
  })
  .meta({ id: "ErrorEnvelope", description: "BFF 공통 에러 응답" });

function successEnvelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

// ============================================================================
// detect-roof request body
//   route.ts 가 imageDataUrl 만 강제 검증하므로 동일하게 표현
// ============================================================================

const DetectRequestSchema = z
  .object({
    imageDataUrl: z
      .string()
      .meta({
        description: "base64 data URL (image/png | image/jpeg | image/webp)",
        example: "data:image/png;base64,iVBORw0KGgoAAAANS...",
      }),
    bounds: z
      .object({
        sw: z.object({ lat: z.number(), lng: z.number() }),
        ne: z.object({ lat: z.number(), lng: z.number() }),
      })
      .optional()
      .meta({ description: "캡처 영역의 SW/NE 위경도 (선택)" }),
  })
  .meta({ id: "DetectRequest", description: "지붕 감지 요청 본문" });

// ============================================================================
// Reusable 컴포넌트 등록 (id 부여 → createDocument 의 reused:"ref" 옵션으로 $ref 화)
// ============================================================================

const RegisteredPolygonSchema = PolygonSchema.meta({
  id: "DetectPolygon",
  description: "정규화 좌표(0~1)로 표현된 지붕 폴리곤",
});

const RegisteredDetectResponseSchema = DetectResponseSchema.meta({
  id: "DetectResponse",
  description: "Gemini Vision 2단계 추론 결과",
});

const RegisteredBboxResponseSchema = BboxResponseSchema.meta({
  id: "BboxResponse",
  description: "1단계 bbox 추론 결과 (내부 디버그용)",
});

const RegisteredBtcItemSchema = BtcItemSchema.meta({
  id: "BtcItem",
  description: "QSP 자재 마스터 항목 (Module 또는 Battery)",
});

const RegisteredSimulationInputSchema = SimulationInputSchema.meta({
  id: "SimulationInput",
  description: "PV 발전 시뮬레이션 입력 (04/05 공용)",
});

// 라우트별 성공 응답 envelope — id 부여로 클라이언트 코드 생성기에서 named type 생성
const BtcItemsSuccessSchema = successEnvelope(z.array(RegisteredBtcItemSchema))
  .meta({ id: "BtcItemsResponse", description: "BTC 자재 마스터 조회 성공" });

const SimCheckSuccessSchema = successEnvelope(z.object({ redirectUrl: z.string() }))
  .meta({ id: "SimCheckResponse", description: "검증 성공 — 결과 페이지 리다이렉트 URL 반환" });

// ============================================================================
// image upload (multipart) — route.ts 의 검증 규칙을 문서로 표현
// ============================================================================

const UploadImageRequestSchema = z
  .object({
    file: z.string().meta({
      format: "binary",
      description: `업로드할 이미지 파일 (${ALLOWED_IMAGE_TYPES.join(", ")}, 최대 10MB)`,
    }),
  })
  .meta({ id: "UploadImageRequest", description: "이미지 업로드 multipart 본문" });

const RegisteredUploadImageResultSchema = UploadImageResultSchema.meta({
  id: "UploadImageResult",
  description: "S3 업로드 결과 (공개 URL + 오브젝트 키)",
});

const UploadImageSuccessSchema = successEnvelope(RegisteredUploadImageResultSchema)
  .meta({ id: "UploadImageResponse", description: "이미지 업로드 성공" });

// reused:"ref" 옵션과 함께 paths 에서 직접 참조하지 않아도 components 에 포함되도록 보장.
// DetectPolygon / BboxResponse 는 DetectResponse 내부에서만 사용되지만 독립 컴포넌트로 노출.
const COMPONENT_SCHEMAS = {
  DetectPolygon: RegisteredPolygonSchema,
  BboxResponse: RegisteredBboxResponseSchema,
} as const;

// ============================================================================
// 라우트별 응답 정의 헬퍼
// ============================================================================

const errorContent = {
  "application/json": { schema: ErrorEnvelopeSchema },
};

function jsonContent(schema: z.ZodTypeAny) {
  return { "application/json": { schema } };
}

// ============================================================================
// OpenAPI 문서 생성
// ============================================================================

export function buildOpenApiDocument() {
  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "Solar PV System API",
      version: "0.1.0",
      description:
        "Solar PV 옥상 패널 레이아웃 플래너의 내부 API. " +
        "지붕 자동 감지(Gemini Vision)와 QSP/MUSBI BFF를 노출한다.",
    },
    servers: [
      { url: "http://localhost:3000", description: "Local dev" },
    ],
    tags: [
      { name: "detect", description: "지붕 자동 감지" },
      { name: "qsp", description: "QSP.Connector BFF — 마스터" },
      { name: "musbi", description: "MUSBI BFF — 시뮬레이션" },
      { name: "image", description: "참조 이미지 S3 업로드/삭제" },
    ],
    // DetectPolygon / BboxResponse 는 paths 에서 직접 참조되지 않으므로
    // 여기서 명시 등록해 노출. 그 외 .meta({id}) 부여 스키마는 paths 안
    // 인스턴스 매칭으로 zod-openapi 가 자동 $ref 처리한다.
    components: {
      schemas: COMPONENT_SCHEMAS,
    },
    paths: {
      "/api/detect-roof": {
        post: {
          tags: ["detect"],
          summary: "지붕 폴리곤 자동 감지",
          description:
            "위성 이미지(data URL)를 받아 Gemini Vision 2단계 추론으로 지붕 폴리곤 후보를 반환한다.",
          requestBody: {
            required: true,
            content: jsonContent(DetectRequestSchema),
          },
          responses: {
            "200": {
              description: "감지 성공 (폴리곤이 0개일 수도 있음)",
              content: jsonContent(RegisteredDetectResponseSchema),
            },
            "400": { description: "잘못된 요청 본문", content: errorContent },
            "413": { description: "요청 본문 초과", content: errorContent },
            "429": { description: "Rate limit (upstream)", content: errorContent },
            "500": { description: "서버 설정 오류 (API 키/모델 미설정)", content: errorContent },
            "502": { description: "Upstream(Gemini) 오류", content: errorContent },
            "504": { description: "Upstream 타임아웃 (인프라 레벨)", content: errorContent },
          },
        },
      },
      "/api/qsp/btc-items": {
        get: {
          tags: ["qsp"],
          summary: "BTC Google Map 아이템 마스터 조회",
          description: "QSP 자재 마스터(모듈/배터리)를 조회한다. (사양 03)",
          requestParams: {
            query: BtcItemsInputSchema,
          },
          responses: {
            "200": {
              description: "조회 성공",
              content: jsonContent(BtcItemsSuccessSchema),
            },
            "400": { description: "쿼리 파라미터 검증 실패", content: errorContent },
            "401": { description: "Upstream 토큰 만료", content: errorContent },
            "422": { description: "Upstream 검증 실패", content: errorContent },
            "500": { description: "서버 설정 오류", content: errorContent },
            "502": { description: "Upstream 오류", content: errorContent },
            "504": { description: "Upstream 타임아웃", content: errorContent },
          },
        },
      },
      "/api/musbi/sim-check": {
        post: {
          tags: ["musbi"],
          summary: "PV 발전 시뮬레이션 결과 사전 검증",
          description: "계산 전 입력 파라미터 검증을 수행한다. (사양 04)",
          requestBody: {
            required: true,
            content: jsonContent(RegisteredSimulationInputSchema),
          },
          responses: {
            "200": {
              description: "검증 통과 (data 는 항상 null)",
              content: jsonContent(SimCheckSuccessSchema),
            },
            "400": { description: "본문 검증 실패", content: errorContent },
            "401": { description: "Upstream 토큰 만료", content: errorContent },
            "422": { description: "Upstream 검증 실패", content: errorContent },
            "500": { description: "서버 설정 오류", content: errorContent },
            "502": { description: "Upstream 오류", content: errorContent },
            "504": { description: "Upstream 타임아웃", content: errorContent },
          },
        },
      },
      "/api/image/upload": {
        post: {
          tags: ["image"],
          summary: "참조 이미지 S3 업로드",
          description:
            "multipart/form-data 의 file 필드를 S3 `pvmap/{uuid}.{ext}` 키로 업로드하고 공개 URL 을 반환한다.",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": { schema: UploadImageRequestSchema },
            },
          },
          responses: {
            "200": {
              description: "업로드 성공",
              content: jsonContent(UploadImageSuccessSchema),
            },
            "400": { description: "file 누락 / 미지원 타입 / 빈 파일", content: errorContent },
            "413": { description: "파일 크기 초과 (10MB)", content: errorContent },
            "429": { description: "Rate limit", content: errorContent },
            "500": { description: "서버 설정 오류 (S3 env 미설정)", content: errorContent },
            "502": { description: "S3 업로드 실패", content: errorContent },
          },
        },
      },
    },
  });
}
