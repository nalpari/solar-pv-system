"use client";

import Image from "next/image";
import { Button, Radio, SelectBox, InputBox } from "@/components/common";
import { ChevronRight, Section } from "./section";
import type { SimulationFormState } from "../SimulationPanel";
import { t, type Lang } from "../../utils/i18n";

// 16方位 — matches the existing SimulationPanel catalog so handlers stay compatible.
const COMPASS_DIRECTIONS = [
  { value: "S", ja: "南", en: "S" },
  { value: "SSW", ja: "南南西", en: "SSW" },
  { value: "SW", ja: "南西", en: "SW" },
  { value: "WSW", ja: "西南西", en: "WSW" },
  { value: "W", ja: "西", en: "W" },
  { value: "WNW", ja: "西北西", en: "WNW" },
  { value: "NW", ja: "北西", en: "NW" },
  { value: "NNW", ja: "北北西", en: "NNW" },
  { value: "N", ja: "北", en: "N" },
  { value: "NNE", ja: "北北東", en: "NNE" },
  { value: "NE", ja: "北東", en: "NE" },
  { value: "ENE", ja: "東北東", en: "ENE" },
  { value: "E", ja: "東", en: "E" },
  { value: "ESE", ja: "東南東", en: "ESE" },
  { value: "SE", ja: "南東", en: "SE" },
  { value: "SSE", ja: "南南東", en: "SSE" },
] as const;

const BATTERY_MODELS = [
  { value: "q-ready-7.7", label: "Q.READY 7.7kWh" },
  { value: "q-ready-11.5", label: "Q.READY 11.5kWh" },
  { value: "q-ready-15.3", label: "Q.READY 15.3kWh" },
];

export interface LnbSimProps {
  lang?: Lang;
  formState: SimulationFormState;
  onFormChange: (state: SimulationFormState) => void;
  onGoBack: () => void;
  onSubmit: () => void;
}

export function LnbSim({
  lang = "ja",
  formState,
  onFormChange,
  onGoBack,
  onSubmit,
}: LnbSimProps) {
  const { azimuth, hasBattery, batteryModel, monthlyElecCost } = formState;

  function update(patch: Partial<SimulationFormState>) {
    onFormChange({ ...formState, ...patch });
  }

  function formatCurrency(value: string): string {
    const num = value.replace(/[^0-9]/g, "");
    if (!num) return "";
    return Number(num).toLocaleString();
  }

  function handleCostChange(value: string) {
    update({ monthlyElecCost: value.replace(/[^0-9]/g, "") });
  }

  return (
    <>
      <div
        className="flex-1 overflow-x-hidden overflow-y-auto min-h-0 -ml-4 pl-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-button]:size-0 [&::-webkit-scrollbar-button]:[display:none] [&::-webkit-scrollbar-thumb]:bg-[#c4c4c4] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
        dir="rtl"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#c4c4c4 transparent" }}
      >
        <div className="flex flex-col gap-3" dir="ltr">
          {/* Section 1: 方位設定 */}
          <Section
            title={t("azimuthSetting", lang)}
            iconSrc="/assets/images/contents/tab02_cont_icon01.svg"
            iconWidth={17}
            iconHeight={17}
          >
            <SelectBox
              value={azimuth}
              onChange={(e) => update({ azimuth: e.target.value })}
              options={[
                { value: "", label: t("azimuthPlaceholder", lang) },
                ...COMPASS_DIRECTIONS.map((d) => ({
                  value: d.value,
                  label: `${d[lang]} (${d.value})`,
                })),
              ]}
            />
            <div className="flex gap-6 items-center">
              <Compass selected={azimuth} />
              <div className="flex-1 pt-[10px] text-[12px] leading-[1.5] text-[#333]">
                <p className="mb-0">{t("azimuthGuideLine1", lang)}</p>
                <p>{t("azimuthGuideLine2", lang)}</p>
              </div>
            </div>
          </Section>

          {/* Section 2: 蓄電池 */}
          <Section
            title={t("batteryShort", lang)}
            iconSrc="/assets/images/contents/tab02_cont_icon02.svg"
            iconWidth={18}
            iconHeight={12}
          >
            <p className="text-[12px] leading-[1.5] text-[#999]">
              {t("batteryUnitDescription", lang)}
            </p>
            <div className="flex gap-6">
              <Radio
                name="battery"
                checked={hasBattery}
                onChange={() => update({ hasBattery: true })}
                label={t("batteryYes", lang)}
              />
              <Radio
                name="battery"
                checked={!hasBattery}
                onChange={() => update({ hasBattery: false })}
                label={t("batteryNo", lang)}
              />
            </div>
            {hasBattery && (
              <SelectBox
                value={batteryModel}
                onChange={(e) => update({ batteryModel: e.target.value })}
                options={BATTERY_MODELS}
              />
            )}
          </Section>

          {/* Section 3: 月平均電気料金 */}
          <Section
            title={t("monthlyElecCost", lang)}
            iconSrc="/assets/images/contents/tab02_cont_icon03.svg"
            iconWidth={13}
            iconHeight={16}
          >
            <InputBox
              value={
                formatCurrency(monthlyElecCost) +
                (monthlyElecCost ? `(${t("currencySuffix", lang)})` : "")
              }
              onChange={(e) => handleCostChange(e.target.value)}
              placeholder={t("monthlyElecCostPlaceholder", lang)}
              inputMode="numeric"
              className="[&_input]:text-right [&_input]:text-[16px] [&_input]:font-medium"
            />
          </Section>
        </div>
      </div>

      <div className="flex flex-col gap-2 shrink-0 pb-4">
        <Button
          variant="orange-outline"
          className="w-full"
          onClick={onGoBack}
        >
          {t("backToModuleEdit", lang)}
        </Button>
        <Button
          variant="orange"
          iconPosition="right"
          className="w-full"
          onClick={onSubmit}
          disabled={azimuth === "" || monthlyElecCost === ""}
          icon={<ChevronRight />}
        >
          {t("simViewResults", lang)}
        </Button>
      </div>
    </>
  );
}

function Compass({ selected }: { selected: string }) {
  const idx = COMPASS_DIRECTIONS.findIndex((d) => d.value === selected);
  // Position a small red dot around the compass for the selected direction.
  // 16-direction wheel: N at top (angle = -90°), 22.5° step clockwise.
  // Compass image is 98×98; place the dot on a circle of radius 38 around its center.
  const indicator = (() => {
    if (idx < 0) return null;
    const angle = (idx * 22.5 - 90) * (Math.PI / 180);
    const cx = 49;
    const cy = 49;
    const r = 38;
    return { left: cx + Math.cos(angle) * r - 5, top: cy + Math.sin(angle) * r - 5 };
  })();

  return (
    <div className="relative shrink-0">
      <Image
        src="/assets/images/contents/compass_img.svg"
        alt=""
        width={98}
        height={98}
      />
      {indicator && (
        <span
          aria-hidden
          className="absolute size-2.5 rounded-full bg-[#e74] border-2 border-white shadow"
          style={{ left: indicator.left, top: indicator.top }}
        />
      )}
    </div>
  );
}
