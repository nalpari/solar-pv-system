// src/app/api/musbi/sim-check/route.ts
// MUSBI PV 발전시뮬레이션 결과전 검증 조회 BFF (사양 04).
import {
  envelopeError,
  envelopeSuccess,
  formatZodError,
  postSimCheck,
  readJsonBodyWithLimit,
} from "@/lib/qsp/client";
import { SimulationInputSchema } from "@/lib/qsp/schema";

export const runtime = "nodejs";

// SimulationInput 12개 필드 (가장 긴 imgSrc=200자) + JSON 오버헤드 충분.
const MAX_BODY_BYTES = 8 * 1024;

export async function POST(req: Request) {
  const bodyResult = await readJsonBodyWithLimit(req, MAX_BODY_BYTES);
  if (!bodyResult.success) return bodyResult.response;

  const parsed = SimulationInputSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return envelopeError(400, 400, formatZodError(parsed.error));
  }

  const result = await postSimCheck(parsed.data);
  if (!result.success) {
    return envelopeError(result.status, result.code, result.message);
  }
  return envelopeSuccess(result.data);
}
