// src/lib/qsp/schema.ts
// QSP.Connector.API 인터페이스 사양서 기준 zod 스키마.
// 입력은 strict, 응답은 03/04 strict + 05 passthrough (사양 미정).
import { z } from "zod";

// ============================================================================
// 03. BTC Google Map 아이템 정보 조회
//   GET /api/master/btcGoogleItemList
// ============================================================================

export const BtcItemTypeSchema = z.enum(["M", "B"]);
export type BtcItemType = z.infer<typeof BtcItemTypeSchema>;

export const BtcItemsInputSchema = z.object({
  schItemTp: BtcItemTypeSchema.optional(),
});
export type BtcItemsInput = z.infer<typeof BtcItemsInputSchema>;

const BtcModuleSchema = z.object({
  matlCd: z.string().max(20),
  matlGbnCd: z.literal("M"),
  wpOut: z.string().max(5),
  qcastCustPrdId: z.string().max(20),
  qcastCustPrdNm: z.string().max(500),
  basicMatl: z.string().max(40),
  matlDesc: z.string().max(40),
  longAxis: z.number(),
  shortAxis: z.number(),
  thickness: z.number(),
});
export type BtcModule = z.infer<typeof BtcModuleSchema>;

const BtcBatterySchema = z.object({
  matlCd: z.string().max(20),
  matlGbnCd: z.literal("B"),
  wpOut: z.null(),
  qcastCustPrdId: z.string().max(20),
  qcastCustPrdNm: z.string().max(500),
  basicMatl: z.string().max(40),
  matlDesc: z.string().max(40),
  longAxis: z.null(),
  shortAxis: z.null(),
  thickness: z.null(),
});
export type BtcBattery = z.infer<typeof BtcBatterySchema>;

export const BtcItemSchema = z.discriminatedUnion("matlGbnCd", [
  BtcModuleSchema,
  BtcBatterySchema,
]);
export type BtcItem = z.infer<typeof BtcItemSchema>;

// 사양 외 root 필드(code:null, data2:null)는 zod strip 으로 자동 무시.
export const BtcResponseSchema = z.object({
  data: z.array(BtcItemSchema).nullable(),
  result: z.object({
    code: z.number(),
    message: z.string(),
    resultCode: z.string(),
    resultMsg: z.string().nullable().optional(),
  }),
});
export type BtcResponse = z.infer<typeof BtcResponseSchema>;

// ============================================================================
// 04 / 05. PV 발전시뮬레이션 (검증 / 계산)
//   GET /qm/pwrgnSimulationM/checkCalcResults
//   GET /qm/pwrgnSimulationM/calcResults
//   입력 파라미터는 04 = 05 동일하므로 schema 공유.
// ============================================================================

export const SimulationInputSchema = z.object({
  pvSimulationYn: z.literal("Y"),
  postCd: z.string().min(1).max(10),
  moduleItemId: z.string().min(1).max(20),
  moduleCnt: z.number().int().nonnegative(),
  roofCnt: z.number().int().nonnegative(),
  roofLocCd: z.number().finite(),
  roofSlopeCd: z.number().finite(),
  avrgMnthElctBill: z.number().int().nonnegative(),
  batteryItemId: z.string().max(20).optional(),
  imgSrc: z.string().max(200).optional(),
  storageBatteryYn: z.enum(["Y", "N"]).optional(),
  storageBatterySelectYn: z.enum(["Y", "N"]).optional(),
});
export type SimulationInput = z.infer<typeof SimulationInputSchema>;

// 04 응답: 평탄화 envelope (다른 API와 모양이 다름).
export const SimCheckResponseSchema = z.object({
  data: z.unknown().nullable(),
  resultMessage: z.string(),
  resultCode: z.number(),
});
export type SimCheckResponse = z.infer<typeof SimCheckResponseSchema>;
