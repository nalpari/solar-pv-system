// src/lib/qsp/client.ts
// QSP/MUSBI 백엔드 호출 + 응답 정규화 (서버 전용).
// 라우트 핸들러가 공유하는 callQsp 헬퍼와 API 별 호출 함수를 제공한다.
import { NextResponse } from "next/server";
import type { z } from "zod";
import {
  BtcResponseSchema,
  SimCalcResponseSchema,
  SimCheckResponseSchema,
  type BtcItem,
  type BtcItemsInput,
  type SimCalcResponse,
  type SimulationInput,
} from "./schema";

const QSP_API_HOST = process.env.QSP_API_HOST ?? "";
const MUSBI_API_HOST = process.env.MUSBI_API_HOST ?? "";
const DEFAULT_TIMEOUT_MS = 30_000;

type QueryValue = string | number | undefined;
type UpstreamOptions = {
  host: string;
  hostEnvName: "QSP_API_HOST" | "MUSBI_API_HOST";
  logPrefix: "qsp" | "musbi";
  timeoutMs?: number;
};

const QSP_UPSTREAM = {
  host: QSP_API_HOST,
  hostEnvName: "QSP_API_HOST",
  logPrefix: "qsp",
} satisfies UpstreamOptions;

const MUSBI_UPSTREAM = {
  host: MUSBI_API_HOST,
  hostEnvName: "MUSBI_API_HOST",
  logPrefix: "musbi",
} satisfies UpstreamOptions;

export type QspCallResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; code: number; message: string };

function buildUrl(
  base: string,
  path: string,
  query: Record<string, QueryValue>,
): string {
  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

// upstream 응답의 두 가지 result 표현 모두 지원.
//   { result: { code, message } }   ← 03 / 05 공통 포맷
//   { resultCode, resultMessage }   ← 04 평탄화 포맷
function extractUpstreamStatus(data: unknown): { code: number; message: string } {
  if (typeof data !== "object" || data === null) {
    return { code: 0, message: "" };
  }
  const d = data as Record<string, unknown>;
  if (d.result && typeof d.result === "object") {
    const r = d.result as Record<string, unknown>;
    return {
      code: typeof r.code === "number" ? r.code : 0,
      message: typeof r.message === "string" ? r.message : "",
    };
  }
  return {
    code: typeof d.resultCode === "number" ? d.resultCode : 0,
    message: typeof d.resultMessage === "string" ? d.resultMessage : "",
  };
}

function mapUpstreamCodeToStatus(code: number): number {
  if (code === 600) return 401; // 토큰 만료
  if (code === 400) return 422; // 검증 실패
  return 502; // 그 외 upstream 오류
}

// upstream 3개 API (btc-items / sim-check / sim-calc) 모두 GET + querystring 사양.
// BFF 라우트가 POST/JSON 으로 받더라도 여기서 querystring 으로 변환해 GET 으로 호출한다.
async function callQsp<T>(
  routeName: string,
  path: string,
  query: Record<string, QueryValue>,
  schema: z.ZodType<T>,
  options: UpstreamOptions = QSP_UPSTREAM,
): Promise<QspCallResult<T>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const logName = `${options.logPrefix}/${routeName}`;

  if (!options.host) {
    console.error(`[${logName}] ${options.hostEnvName} 미설정`);
    return {
      success: false,
      status: 500,
      code: 0,
      message: `${options.hostEnvName} not configured`,
    };
  }

  const url = buildUrl(options.host, path, query);
  console.log(`[${logName}] → GET ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    clearTimeout(timer);
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") {
      console.warn(`[${logName}] timeout after ${timeoutMs}ms`);
      return {
        success: false,
        status: 504,
        code: 0,
        message: "Upstream timeout",
      };
    }
    console.warn(`[${logName}] fetch error: ${String(err)}`);
    return {
      success: false,
      status: 502,
      code: 0,
      message: "Upstream fetch failed",
    };
  }
  clearTimeout(timer);

  if (!res.ok) {
    console.warn(`[${logName}] upstream HTTP ${res.status} (url=${url})`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    console.warn(
      `[${logName}] invalid JSON from upstream (http=${res.status})`,
    );
    return {
      success: false,
      status: 502,
      code: 0,
      message: "Invalid upstream response",
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .map((i) => `${i.path.join(".")} ${i.message}`)
      .join("; ");
    console.warn(`[${logName}] schema violation: ${issueSummary}`);
    return {
      success: false,
      status: 502,
      code: 0,
      message: "Upstream contract violation",
    };
  }

  const { code, message } = extractUpstreamStatus(parsed.data);
  if (code !== 200) {
    console.warn(`[${logName}] upstream code=${code} message=${message}`);
    return {
      success: false,
      status: mapUpstreamCodeToStatus(code),
      code,
      message,
    };
  }

  return { success: true, data: parsed.data };
}

// ============================================================================
// API 별 caller
// ============================================================================

export async function fetchBtcItems(
  input: BtcItemsInput,
): Promise<QspCallResult<BtcItem[]>> {
  const result = await callQsp(
    "btc-items",
    "/api/master/btcGoogleItemList",
    { schItemTp: input.schItemTp },
    BtcResponseSchema,
  );
  if (!result.success) return result;
  return { success: true, data: result.data.data ?? [] };
}

export async function postSimCheck(
  input: SimulationInput,
): Promise<QspCallResult<null>> {
  const result = await callQsp(
    "sim-check",
    "/qm/pwrgnSimulationM/checkCalcResults",
    input,
    SimCheckResponseSchema,
    MUSBI_UPSTREAM,
  );
  if (!result.success) return result;
  return { success: true, data: null };
}

export async function postSimCalc(
  input: SimulationInput,
): Promise<QspCallResult<SimCalcResponse>> {
  // 05번은 응답 사양 미정 — full body 그대로 클라이언트에 패스스루.
  return callQsp(
    "sim-calc",
    "/qm/pwrgnSimulationM/calcResults",
    input,
    SimCalcResponseSchema,
    MUSBI_UPSTREAM,
  );
}

// ============================================================================
// 라우트 공용 — envelope 응답 헬퍼 + zod 에러 포맷터
// ============================================================================

export function envelopeSuccess<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data });
}

export function envelopeError(
  status: number,
  code: number,
  message: string,
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.join(".") || "(root)"} ${i.message}`)
    .join("; ");
}

// Boston H1: req.json() 직접 호출은 body 크기 제한 없이 메모리/CPU 를 소비.
// arrayBuffer 로 먼저 읽고 byte cap 으로 차단한 뒤 파싱한다.
// 호출자는 success 분기에서 unknown 을 zod 로 검증한다.
export type ReadJsonBodyResult =
  | { success: true; data: unknown }
  | { success: false; response: NextResponse };

export async function readJsonBodyWithLimit(
  req: Request,
  maxBytes: number,
): Promise<ReadJsonBodyResult> {
  let raw: ArrayBuffer;
  try {
    raw = await req.arrayBuffer();
  } catch {
    return {
      success: false,
      response: envelopeError(400, 400, "Failed to read request body"),
    };
  }
  if (raw.byteLength === 0) {
    return { success: false, response: envelopeError(400, 400, "Empty body") };
  }
  if (raw.byteLength > maxBytes) {
    return {
      success: false,
      response: envelopeError(413, 413, "Request body too large"),
    };
  }
  try {
    return {
      success: true,
      data: JSON.parse(new TextDecoder().decode(raw)) as unknown,
    };
  } catch {
    return {
      success: false,
      response: envelopeError(400, 400, "Invalid JSON body"),
    };
  }
}
