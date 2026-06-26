// src/app/api/detect-roof/route.ts
import { NextResponse } from "next/server";
import { ApiError, GoogleGenAI, Type, type Schema } from "@google/genai";
import { envelopeError } from "@/lib/qsp/client";
import {
  DetectResponseSchema,
  type DetectRequestBody,
  type DetectResponse,
} from "@/lib/detect/schema";
import {
  ROOF_DETECT_SYSTEM_PROMPT,
  ROOF_DETECT_USER_PROMPT,
} from "@/lib/detect/prompt";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 5 * 1024 * 1024;
// Boston H1: base64는 원본 대비 약 4/3배 팽창. 5MB 원본을 허용하려면 ~6.67MB의 data URL을 허용해야 함.
// 256 = "data:image/...;base64," 헤더 + JSON wrapper 여유.
const MAX_DATA_URL_LENGTH = Math.ceil((MAX_REQUEST_BYTES * 4) / 3) + 256;
// 환경변수로 모델 식별자 주입. 미설정 시 POST 핸들러에서 500 응답으로 차단.
const DETECT_MODEL = process.env.GEMINI_MODEL ?? "";

type MediaType = "image/png" | "image/jpeg" | "image/webp";

type ParsedDataUrl = {
  mediaType: MediaType;
  base64: string;
};

function parseDataUrl(dataUrl: string): ParsedDataUrl | null {
  const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1] as MediaType, base64: m[3] };
}

function extractJsonPayload(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/.exec(trimmed);
  if (fenced) return fenced[1];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) return trimmed.slice(first, last + 1);
  return null;
}

async function callGeminiJson<T>(
  client: GoogleGenAI,
  image: ParsedDataUrl,
  systemPrompt: string,
  userPrompt: string,
  responseSchema: Schema,
  validate: (parsed: unknown) =>
    | { success: true; data: T }
    | { success: false; error: string },
  // NOTE: on Gemini 3.1 Pro this budget covers **thinking + output**.
  // Multi-face polygons + Gemini 3.1's mandatory thinking can easily burn
  // 10–15K tokens on complex roofs; 32K leaves room on both axes without
  // approaching the 65K model cap.
  maxOutputTokens: number = 32768,
  // Cap thinking to trade a little reasoning depth for substantial latency
  // savings. Gemini 3.1 Pro rejects budget=0 but accepts positive caps;
  // the model will still think, just stop sooner.
  thinkingBudget: number = 4096,
): Promise<T> {
  const response = await client.models.generateContent({
    model: DETECT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: image.mediaType,
              data: image.base64,
            },
          },
          { text: userPrompt },
        ],
      },
    ],
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema,
      maxOutputTokens,
      thinkingConfig: { thinkingBudget },
    },
  });

  const finishReason = response.candidates?.[0]?.finishReason;
  const usage = response.usageMetadata;
  const textLength = response.text?.length ?? 0;
  // Diagnostic — correlates failures with model-reported finish state.
  // Ref: docs/investigations/2026-04-23-gemini-detect-502-analysis.md §5.2
  console.info("[detect-roof] gemini response", {
    model: DETECT_MODEL,
    maxOutputTokens,
    finishReason,
    textLength,
    promptTokens: usage?.promptTokenCount,
    candidatesTokens: usage?.candidatesTokenCount,
    thinkingTokens: usage?.thoughtsTokenCount,
    totalTokens: usage?.totalTokenCount,
  });

  const text = response.text;
  if (!text) {
    throw new Error(
      `Gemini가 텍스트 응답을 반환하지 않았습니다. (finishReason=${finishReason ?? "unknown"})`,
    );
  }
  const payload = extractJsonPayload(text);
  if (!payload) {
    throw new Error("응답에서 JSON 객체를 찾지 못했습니다.");
  }
  const parsed = JSON.parse(payload) as unknown;
  const result = validate(parsed);
  if (!result.success) {
    throw new Error(`스키마 검증 실패: ${result.error}`);
  }
  return result.data;
}

const POLYGON_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["points", "confidence"],
  properties: {
    points: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "64",
      items: {
        type: Type.ARRAY,
        minItems: "2",
        maxItems: "2",
        items: { type: Type.NUMBER, minimum: 0, maximum: 1 },
      },
    },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
  },
};

/**
 * 폴리곤 단위 신뢰도 임계값. 어느 폴리곤이라도 이 값 미만이면 환각으로 판정해
 * 전체 결과를 빈 배열로 차단한다 (reason="low_confidence").
 * 사용자가 실수로 비지붕 영역(도로·들판 등)을 crop했을 때 모델이 그럴듯한 폴리곤을
 * 환각하더라도 자가평가 신뢰도가 낮게 보고되면 차단된다.
 */
const CONFIDENCE_THRESHOLD = 0.5;

const DETECT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["polygons"],
  properties: {
    polygons: { type: Type.ARRAY, items: POLYGON_SCHEMA },
  },
};

async function detectRoofPolygons(
  client: GoogleGenAI,
  image: ParsedDataUrl,
): Promise<DetectResponse> {
  const result = await callGeminiJson(
    client,
    image,
    ROOF_DETECT_SYSTEM_PROMPT,
    ROOF_DETECT_USER_PROMPT,
    DETECT_RESPONSE_SCHEMA,
    (parsed) => {
      const v = DetectResponseSchema.safeParse(parsed);
      if (!v.success) {
        return {
          success: false,
          error: v.error.issues
            .map((i) => `${i.path.join(".")} ${i.message}`)
            .join("; "),
        };
      }
      return { success: true, data: v.data };
    },
  );
  if (result.polygons.length === 0) {
    console.warn("[detect-roof] 폴리곤 0개 반환");
    return { polygons: [], reason: "no_polygons" };
  }
  // 어느 폴리곤이라도 신뢰도 임계값 미만 → 환각 의심 → 전체 차단
  // (PARTITION 보존 — 일부만 제거하면 합집합에 빈 공간 발생)
  const minConfidence = Math.min(...result.polygons.map((p) => p.confidence));
  if (minConfidence < CONFIDENCE_THRESHOLD) {
    console.warn(
      `[detect-roof] 신뢰도 미달 — 최저 ${minConfidence.toFixed(3)} < ${CONFIDENCE_THRESHOLD}, 환각 의심`,
    );
    return { polygons: [], reason: "low_confidence" };
  }
  return { polygons: result.polygons, reason: "ok" };
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[detect-roof] GEMINI_API_KEY 미설정");
    return envelopeError(500, 500, "Server is missing GEMINI_API_KEY");
  }
  if (!DETECT_MODEL) {
    console.error("[detect-roof] GEMINI_MODEL 미설정");
    return envelopeError(500, 500, "Server is missing GEMINI_MODEL");
  }

  // Boston H1: Content-Length 헤더는 위조/누락 시 NaN으로 분기 통과 가능 →
  // arrayBuffer().byteLength로 직접 검증하여 req.json() 메모리 폭탄 방지.
  let raw: ArrayBuffer;
  try {
    raw = await req.arrayBuffer();
  } catch {
    return envelopeError(400, 400, "Failed to read request body");
  }
  if (raw.byteLength === 0) {
    return envelopeError(400, 400, "Empty body");
  }
  if (raw.byteLength > MAX_DATA_URL_LENGTH) {
    return envelopeError(413, 413, "Request body too large");
  }

  let body: DetectRequestBody;
  try {
    body = JSON.parse(new TextDecoder().decode(raw)) as DetectRequestBody;
  } catch {
    return envelopeError(400, 400, "Invalid JSON body");
  }

  if (!body?.imageDataUrl || typeof body.imageDataUrl !== "string") {
    return envelopeError(400, 400, "imageDataUrl is required");
  }
  const image = parseDataUrl(body.imageDataUrl);
  if (!image) {
    return envelopeError(
      400,
      400,
      "imageDataUrl must be a base64 data URL (png/jpeg/webp)",
    );
  }

  const client = new GoogleGenAI({ apiKey });

  try {
    const result = await detectRoofPolygons(client, image);
    return NextResponse.json(result satisfies DetectResponse);
  } catch (err) {
    if (err instanceof ApiError) return respondWithUpstreamError(err);
    console.error("[detect-roof] 분석 실패:", err);
    return envelopeError(
      502,
      502,
      "분석에 일시적으로 실패했습니다. 잠시 후 다시 시도하세요.",
    );
  }
}

// Keep provider-specific hints (model name, tier, key source) in server logs only.
// The client response contains a generic message + status code so the UI can
// differentiate rate-limit vs. service-down, without leaking the upstream provider
// or deployment configuration.
function respondWithUpstreamError(err: ApiError) {
  console.error(`[detect-roof] upstream ${err.status}:`, err.message);
  const clientMessage =
    err.status === 429
      ? "요청이 일시적으로 많습니다. 잠시 후 다시 시도하세요."
      : err.status === 403 || err.status === 401
        ? "서비스 설정 오류로 분석할 수 없습니다. 관리자에게 문의하세요."
        : "분석 서비스가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도하세요.";
  // Clamp upstream status to safe client-visible codes.
  const clientStatus = err.status === 429 ? 429 : 502;
  return envelopeError(clientStatus, clientStatus, clientMessage);
}
