// src/app/api/qsp/btc-items/route.ts
// QSP BTC Google Map 아이템 정보 조회 BFF (사양 03).
import {
  envelopeError,
  envelopeSuccess,
  fetchBtcItems,
  formatZodError,
} from "@/lib/qsp/client";
import { BtcItemsInputSchema } from "@/lib/qsp/schema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = BtcItemsInputSchema.safeParse({
    schItemTp: searchParams.get("schItemTp") ?? undefined,
  });
  if (!parsed.success) {
    return envelopeError(400, 400, formatZodError(parsed.error));
  }

  const result = await fetchBtcItems(parsed.data);
  if (!result.success) {
    return envelopeError(result.status, result.code, result.message);
  }
  return envelopeSuccess(result.data);
}
