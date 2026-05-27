// src/app/api/musbi/simcheck/route.ts
// MUSBI PV 발전시뮬레이션 결과전 검증 조회 BFF (사양 04).
import {
  envelopeError,
  envelopeSuccess,
  formatZodError,
  postSimCheck,
} from "@/lib/qsp/client";
import { SimulationInputSchema } from "@/lib/qsp/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return envelopeError(400, 400, "Invalid JSON body");
  }

  const parsed = SimulationInputSchema.safeParse(body);
  if (!parsed.success) {
    return envelopeError(400, 400, formatZodError(parsed.error));
  }

  const result = await postSimCheck(parsed.data);
  if (!result.success) {
    return envelopeError(result.status, result.code, result.message);
  }
  return envelopeSuccess(result.data);
}
