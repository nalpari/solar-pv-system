// src/app/api/detect-roof/route.ts
import { NextResponse } from "next/server";
import { envelopeError } from "@/lib/qsp/client";
import {
  DetectResponseSchema,
  type DetectRequestBody,
  type DetectResponse,
} from "@/lib/detect/schema";
import {
  ROOF_DETECT_SYSTEM_PROMPT,
  ROOF_DETECT_USER_PROMPT,
  EXTERNAL_HINT_BLOCK,
} from "@/lib/detect/prompt";
import { fetchSamMask } from "@/lib/sam/replicate";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 5 * 1024 * 1024;
// Boston H1: base64는 원본 대비 약 4/3배 팽창. 5MB 원본을 허용하려면 ~6.67MB의 data URL을 허용해야 함.
// 256 = "data:image/...;base64," 헤더 + JSON wrapper 여유.
const MAX_DATA_URL_LENGTH = Math.ceil((MAX_REQUEST_BYTES * 4) / 3) + 256;
// 환경변수로 모델 식별자 주입. 미설정 시 POST 핸들러에서 500 응답으로 차단.
const DETECT_MODEL = process.env.OPENROUTER_MODEL ?? "";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// 순수 fetch 호출이라 SDK 가 제공했던 암묵적 타임아웃이 없다 — AbortController 로 대체한다.
// thinking 모델 단발 호출이고 최대 6.67MB data URL 업로드까지 포함하므로 정상 범위가
// 수 초~수십 초다. 정상 호출을 자르지 않으면서 무한 대기만 막는 값으로 3분을 잡는다.
// (재시도는 없다 — 고비용 비멱등 호출)
const UPSTREAM_TIMEOUT_MS = 180_000;

type MediaType = "image/png" | "image/jpeg" | "image/webp";

type ParsedDataUrl = {
  mediaType: MediaType;
  base64: string;
};

/** 업스트림 HTTP 상태를 보존해 클라이언트 응답 매핑까지 전달하는 로컬 에러. */
class UpstreamError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

type OpenRouterCompletion = {
  model?: string;
  /**
   * generation id. 응답 자체에는 서빙 엔드포인트 정보가 없지만, 이 id 로 사후에
   * `GET /api/v1/generation?id=<id>` 를 조회하면 실제 서빙 프로바이더를 알 수 있다.
   * (여기서 두 번째 HTTP 호출은 하지 않는다 — 로그에 id 만 남긴다.)
   */
  id?: string;
  /** 실제 응답에 흔히 실려오지만 공식 응답 스키마에 없는 필드 — undefined 일 수 있다. */
  provider?: string;
  choices?: {
    message?: { content?: string | null };
    finish_reason?: string | null;
    native_finish_reason?: string | null;
    /** 200 응답에 생성 오류가 실려 오는 경로 (원인 로깅용). */
    error?: unknown;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    /** 호출당 실비 (OpenRouter 고유 지표). */
    cost?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
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

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

// 업스트림 에러 바디는 { error: { message } } 규약이지만 게이트웨이가 HTML/plain 을 줄 수도 있다.
// text 로 먼저 읽어 파싱 실패 시에도 원문 일부를 진단에 남긴다 (서버 로그 전용).
async function readUpstreamMessage(res: Response): Promise<string> {
  let raw: string;
  try {
    raw = await res.text();
  } catch (err) {
    // 본문 읽기 실패는 진단 문자열 손실로만 처리하되, abort(타임아웃)는 반드시 전파한다.
    // 여기서 삼키면 타임아웃이 빈 메시지로 위장돼 호출자의 408 정규화를 통과하지 못한다.
    if (isAbortError(err)) throw err;
    return "";
  }
  try {
    const body = JSON.parse(raw) as { error?: { message?: string } };
    return body.error?.message ?? raw.slice(0, 300);
  } catch {
    return raw.slice(0, 300);
  }
}

async function callOpenRouterJson<T>(
  apiKey: string,
  images: ParsedDataUrl[],
  systemPrompt: string,
  userPrompt: string,
  responseSchema: Record<string, unknown>,
  validate: (parsed: unknown) =>
    | { success: true; data: T }
    | { success: false; error: string },
  clientSignal: AbortSignal,
  // NOTE: OpenRouter 의 max_tokens 는 **reasoning + output 합산** 예산이다.
  // Multi-face polygons + thinking 이 복잡한 지붕에서 10~15K 토큰을 태울 수 있다.
  // 작게 잡으면 reasoning 이 예산을 소진해 finish_reason="length" + 빈 content 로 전멸한다.
  maxTokens: number = 32768,
): Promise<T> {
  const body = {
    model: DETECT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        // 이미지 먼저(원본 → SAM 마스크 순서는 계약 — EXTERNAL_HINT_BLOCK 이 "second image" 를 참조),
        // 텍스트 프롬프트를 마지막에 붙인다.
        content: [
          ...images.map((img) => ({
            type: "image_url",
            image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
          })),
          { type: "text", text: userPrompt },
        ],
      },
    ],
    max_tokens: maxTokens,
    // reasoning 을 생략하면 기본 thinking(high)으로 동작해 지연이 커진다 — 반드시 명시한다.
    // exclude: reasoning 텍스트가 extractJsonPayload 를 오염시키지 않게.
    // effort 와 reasoning.max_tokens 동시 지정은 금지(충돌).
    reasoning: { effort: "low", exclude: true },
    response_format: {
      type: "json_schema",
      json_schema: { name: "roof_faces", strict: true, schema: responseSchema },
    },
    // structured output / vision 미지원 엔드포인트를 배제. order·allow_fallbacks 는 지정하지 않는다
    // (엔드포인트 장애 시 우회로를 스스로 막는 쪽의 손해가 더 크다).
    provider: { require_parameters: true },
    // usage 회계 필드(cost · completion_tokens_details.reasoning_tokens)는 이 플래그가
    // 있어야 채워진다 — 없으면 아래 로그에 전부 undefined 로 찍힌다.
    usage: { include: true },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const startedAt = performance.now();

  // fetch() 는 응답 헤더가 도착하면 resolve 하므로 본문 읽기까지 같은 try 안에 두고
  // 가장 바깥 finally 에서 타이머를 해제해야 한다 — 그렇지 않으면 헤더만 보내고 본문을
  // 멈춘 업스트림/프록시에서 무기한 대기한다.
  let data: OpenRouterCompletion;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // 클라이언트가 재크롭 등으로 요청을 끊으면 상류 생성도 함께 끊는다 — 연결하지 않으면
      // 아무도 읽지 않을 응답을 최대 180초까지 만들며 과금된다.
      signal: AbortSignal.any([clientSignal, controller.signal]),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new UpstreamError(res.status, await readUpstreamMessage(res));
    }
    data = (await res.json()) as OpenRouterCompletion;
  } catch (err) {
    // !res.ok 로 이미 status 를 담아 던진 에러는 그대로 통과시킨다.
    if (err instanceof UpstreamError) throw err;
    if (isAbortError(err)) {
      // 타임아웃과 클라이언트 취소는 둘 다 AbortError 로 온다 — 어느 쪽이 끊었는지 구분해 남긴다.
      const reason = controller.signal.aborted
        ? `timeout after ${UPSTREAM_TIMEOUT_MS}ms`
        : "client aborted";
      console.warn(`[detect-roof] upstream aborted — ${reason}`);
      throw new UpstreamError(408, reason);
    }
    const cause =
      err instanceof Error && err.cause ? ` | cause=${String(err.cause)}` : "";
    throw new UpstreamError(502, `fetch failed: ${String(err)}${cause}`);
  } finally {
    clearTimeout(timer);
  }

  const elapsedMs = Math.round(performance.now() - startedAt);
  const choice = data.choices?.[0];
  const usage = data.usage;
  const text = choice?.message?.content ?? "";
  // Diagnostic — correlates failures with model-reported finish state.
  // Ref: docs/investigations/2026-04-23-gemini-detect-502-analysis.md §5.2
  // completion_tokens 와 reasoning_tokens 는 동치성이 미검증이라 각각 원값으로 남긴다(뺄셈 금지).
  console.info("[detect-roof] openrouter response", {
    model: DETECT_MODEL,
    resolvedModel: data.model,
    maxTokens,
    elapsedMs,
    finishReason: choice?.finish_reason,
    nativeFinishReason: choice?.native_finish_reason,
    textLength: text.length,
    promptTokens: usage?.prompt_tokens,
    completionTokens: usage?.completion_tokens,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
    totalTokens: usage?.total_tokens,
    cost: usage?.cost,
    generationId: data.id,
    provider: data.provider,
  });

  // 200 인데 생성 단계 오류가 실려 온 경우. content 가 유효해 보여도 성공으로 내보내면
  // 생성 오류가 조용히 숨는다 — 빈 content 경로와 동일하게 502 로 차단한다.
  if (choice?.error) {
    console.error("[detect-roof] upstream inline error:", choice.error);
    throw new Error("모델 응답에 생성 오류가 포함되었습니다.");
  }

  // 예산 소진으로 잘린 응답은 문법상 유효한 JSON(일부 지붕면만 담긴 polygons)일 수 있고,
  // 그대로 통과하면 불완전한 지붕 분할이 패널 배치까지 전파된다. 정상 완료는 "stop" 이다.
  if (choice?.finish_reason === "length") {
    throw new Error("모델 응답이 토큰 예산 소진으로 잘렸습니다. (finish_reason=length)");
  }

  if (!text) {
    throw new Error(
      `모델이 텍스트 응답을 반환하지 않았습니다. (finish_reason=${choice?.finish_reason ?? "unknown"})`,
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

// strict json_schema 요건: 모든 object 에 additionalProperties:false.
// zod(DetectResponseSchema)가 최종 SSOT 이고 이 스키마는 1차 계약이다.
const POLYGON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["points", "confidence"],
  properties: {
    points: {
      type: "array",
      minItems: 3,
      maxItems: 64,
      items: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

/**
 * 폴리곤 단위 신뢰도 임계값. 어느 폴리곤이라도 이 값 미만이면 환각으로 판정해
 * 전체 결과를 빈 배열로 차단한다 (reason="low_confidence").
 * 사용자가 실수로 비지붕 영역(도로·들판 등)을 crop했을 때 모델이 그럴듯한 폴리곤을
 * 환각하더라도 자가평가 신뢰도가 낮게 보고되면 차단된다.
 */
const CONFIDENCE_THRESHOLD = 0.5;

// reason 은 모델 출력 스키마에 넣지 않는다 — 서버 후처리가 붙이는 값.
const DETECT_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["polygons"],
  properties: {
    polygons: { type: "array", items: POLYGON_SCHEMA },
  },
};

async function detectRoofPolygons(
  apiKey: string,
  image: ParsedDataUrl,
  imageDataUrl: string,
  clientSignal: AbortSignal,
): Promise<DetectResponse> {
  // [SAM PoC] Replicate Meta SAM 2로 건물 마스크 얻기. 실패 시 null → 원본 단독 진행.
  const samMaskDataUrl = await fetchSamMask(imageDataUrl);
  const samMask = samMaskDataUrl ? parseDataUrl(samMaskDataUrl) : null;

  const images = samMask ? [image, samMask] : [image];
  const systemPrompt = samMask
    ? `${ROOF_DETECT_SYSTEM_PROMPT}\n\n${EXTERNAL_HINT_BLOCK}`
    : ROOF_DETECT_SYSTEM_PROMPT;

  console.info("[detect-roof] openrouter input", {
    sam_mask_attached: samMask !== null,
    image_count: images.length,
  });

  const result = await callOpenRouterJson(
    apiKey,
    images,
    systemPrompt,
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
    clientSignal,
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
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[detect-roof] OPENROUTER_API_KEY 미설정");
    return envelopeError(500, 500, "Server is missing OPENROUTER_API_KEY");
  }
  if (!DETECT_MODEL) {
    console.error("[detect-roof] OPENROUTER_MODEL 미설정");
    return envelopeError(500, 500, "Server is missing OPENROUTER_MODEL");
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

  try {
    const result = await detectRoofPolygons(
      apiKey,
      image,
      body.imageDataUrl,
      req.signal,
    );
    return NextResponse.json(result satisfies DetectResponse);
  } catch (err) {
    if (err instanceof UpstreamError) return respondWithUpstreamError(err);
    console.error("[detect-roof] 분석 실패:", err);
    return envelopeError(
      502,
      502,
      "분석에 일시적으로 실패했습니다. 잠시 후 다시 시도하세요.",
    );
  }
}

// Keep provider-specific hints (model name, tier, key source, upstream message) in
// server logs only. The client response contains a generic message + status code so the
// UI can differentiate rate-limit vs. service-down, without leaking the upstream
// provider or deployment configuration.
function respondWithUpstreamError(err: UpstreamError) {
  console.error(`[detect-roof] upstream ${err.status}:`, err.message);
  const clientMessage =
    err.status === 429
      ? "요청이 일시적으로 많습니다. 잠시 후 다시 시도하세요."
      : // 402 = 크레딧 소진. 관리자 조치가 필요하다는 점에서 401/403 과 같은 클래스다.
        err.status === 401 || err.status === 402 || err.status === 403
        ? "서비스 설정 오류로 분석할 수 없습니다. 관리자에게 문의하세요."
        : "분석 서비스가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도하세요.";
  // Clamp upstream status to safe client-visible codes.
  const clientStatus = err.status === 429 ? 429 : 502;
  return envelopeError(clientStatus, clientStatus, clientMessage);
}
