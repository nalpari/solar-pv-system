"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { Button, SelectBox } from "@/components/common";
import { ChevronRight, Hint, Section } from "./section";
import { BaechiTip, TipPopover } from "./tip-popover";
import { AddressInputLnb } from "./address-input-lnb";
import { t, type Lang } from "../../utils/i18n";
import type { PanelSize, PanelOrientation } from "../../types";

// 5단계 경사 옵션 — value는 寸 숫자, label은 풍부 텍스트(명세)
const SLOPE_OPTIONS: { value: number; labelKey: "slopeLabel1" | "slopeLabel3" | "slopeLabel4" | "slopeLabel6" | "slopeLabel8" }[] = [
  { value: 1, labelKey: "slopeLabel1" },
  { value: 3, labelKey: "slopeLabel3" },
  { value: 4, labelKey: "slopeLabel4" },
  { value: 6, labelKey: "slopeLabel6" },
  { value: 8, labelKey: "slopeLabel8" },
];

// Panel preset catalog — pv-pub style single-line module names.
// Eventually swapped out by a module-loading API; for now the first option
// is the pv-pub showcase label, with existing presets following.
const MODULE_PRESETS: { value: string; label: string; size: PanelSize }[] = [
  { value: "re-rize-g3-440", label: "Re-RIZE-G3 440", size: { label: "Re-RIZE-G3 440", width: 991, height: 1722 } },
  { value: "preset-60", label: "Standard 60-Cell", size: { label: "Standard 60-Cell", width: 991, height: 1650 } },
  { value: "preset-72", label: "Standard 72-Cell", size: { label: "Standard 72-Cell", width: 991, height: 1960 } },
  { value: "preset-large", label: "Large Format", size: { label: "Large Format", width: 1134, height: 2278 } },
];

export interface LnbDesignProps {
  lang?: Lang;
  // Address & crop
  onPlaceSelect: (location: {
    lat: number;
    lng: number;
    address: string;
    viewport?: google.maps.LatLngBounds;
  }) => void;
  cropMode: boolean;
  /** 크롭 팝업(CropPopup)이 열려있는 상태 — 명세상 건물 확정 완료 후에만 노출되는 섹션 토글에 사용 */
  cropPopupOpen: boolean;
  onCropModeToggle: () => void;
  // Slope
  slope: number | null;
  onSlopeChange: (slope: number | null) => void;
  /** 지붕면 개수 — 1개 이상일 때만 경사 셀렉트 활성화 */
  areaCount: number;
  // Panel config — null이면 모듈 미선택 상태
  panelSize: PanelSize | null;
  onPanelSizeChange: (size: PanelSize) => void;
  // Results
  orientation: PanelOrientation;
  panelCount: number;
  canPlace: boolean;
  placementError: string | null;
  onPlacePanels: (layout: "aligned" | "staggered") => void;
  onDeleteAllPanels: () => void;
  // Detect state
  detectStatus: "idle" | "detecting";
  // Bottom CTAs
  onPlacementDone?: () => void;
  onSwitchToSimulation: () => void;
}

export function LnbDesign({
  lang = "ja",
  onPlaceSelect,
  cropMode,
  cropPopupOpen,
  onCropModeToggle,
  slope,
  onSlopeChange,
  areaCount,
  panelSize,
  onPanelSizeChange,
  orientation,
  panelCount,
  canPlace,
  placementError,
  onPlacePanels,
  onDeleteAllPanels,
  detectStatus,
  onPlacementDone,
  onSwitchToSimulation,
}: LnbDesignProps) {
  const detecting = detectStatus === "detecting";

  const [moduleOptions, setModuleOptions] = useState(MODULE_PRESETS);
  const [modulesLoading, setModulesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/qsp/btc-items?schItemTp=M")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          const items = json.data as Array<{
            matlCd: string;
            qcastCustPrdNm: string;
            matlGbnCd: string;
            shortAxis: number;
            longAxis: number;
          }>;
          const modules = items
            .filter((item) => item.matlGbnCd === "M")
            .map((item) => ({
              value: item.matlCd,
              label: item.qcastCustPrdNm,
              size: {
                label: item.qcastCustPrdNm,
                width: item.shortAxis,
                height: item.longAxis,
              } as PanelSize,
            }));
          if (modules.length > 0) {
            // 명세: 모듈은 기본 미선택 — 카탈로그만 채우고 자동 선택하지 않음
            setModuleOptions(modules);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to fetch btc-items:", err);
      })
      .finally(() => {
        if (!cancelled) setModulesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 선택된 panelSize를 카탈로그와 매칭 — 미선택(null)이면 placeholder("") 노출
  const currentModule = panelSize
    ? moduleOptions.find(
        (p) => p.size.width === panelSize.width && p.size.height === panelSize.height,
      )?.value ?? ""
    : "";

  function handleModuleChange(value: string) {
    const preset = moduleOptions.find((p) => p.value === value);
    if (preset) {
      onPanelSizeChange({ ...preset.size });
      onDeleteAllPanels(); // 모듈 변경 시 기존 배치 모듈 전체 삭제
    }
  }

  const panelW = panelSize ? (orientation === "landscape" ? panelSize.height : panelSize.width) : 0;
  const panelH = panelSize ? (orientation === "landscape" ? panelSize.width : panelSize.height) : 0;
  const panelKw = (panelW * panelH) / 1_000_000 * 0.2; // rough estimate ~200W/m²
  const totalKw = panelCount * panelKw;

  return (
    <>
      <div
        className="flex-1 overflow-x-hidden overflow-y-auto min-h-0 -ml-4 pl-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-button]:size-0 [&::-webkit-scrollbar-button]:[display:none] [&::-webkit-scrollbar-thumb]:bg-[#c4c4c4] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
        dir="rtl"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#c4c4c4 transparent" }}
      >
        <div className="flex flex-col gap-3" dir="ltr">
          {/* Section 1: モジュール配置 (address + building confirm) */}
          <Section
            title={t("sectionModulePlacement", lang)}
            iconSrc="/assets/images/contents/tab01_cont_icon01.svg"
            iconWidth={14}
            iconHeight={16}
          >
            <div className="flex flex-col gap-2">
              <AddressInputLnb lang={lang} onPlaceSelect={onPlaceSelect} disabled={cropMode} />
              <Button
                variant="primary"
                className="w-full"
                onClick={onCropModeToggle}
                aria-pressed={cropMode}
                disabled={cropPopupOpen}
                icon={
                  <Image
                    src="/assets/images/common/btn_icon01.svg"
                    alt=""
                    width={16}
                    height={16}
                  />
                }
              >
                {t("confirmBuilding", lang)}
              </Button>
            </div>
            <Hint>
              {cropMode ? t("cropModeActive", lang) : t("buildingConfirmHint", lang)}
            </Hint>
          </Section>

          {/* Sections 2~4: 명세상 "건물 확정 완료 후"에만 노출 (CropPopup 열림 = cropData 존재) */}
          {cropPopupOpen && <>
          {/* Section 2: 屋根面傾斜 */}
          <Section
            title={t("sectionRoofSlope", lang)}
            iconSrc="/assets/images/contents/tab01_cont_icon02.svg"
            iconWidth={16}
            iconHeight={16}
            tip
          >
            <SelectBox
              value={slope === null ? "" : String(slope)}
              onChange={(e) => onSlopeChange(e.target.value === "" ? null : Number(e.target.value))}
              disabled={detecting || areaCount === 0}
              options={[
                { value: "", label: t("selectPlaceholder", lang), disabled: true, hidden: true },
                ...SLOPE_OPTIONS.map((opt) => ({
                  value: String(opt.value),
                  label: t(opt.labelKey, lang),
                })),
              ]}
            />
          </Section>

          {/* Section 3: モジュール配置 (module type + placement actions) */}
          <Section
            title={t("sectionModulePlacement", lang)}
            iconSrc="/assets/images/contents/tab01_cont_icon03.svg"
            iconWidth={14}
            iconHeight={16}
          >
            <div className="flex flex-col gap-2">
              <SelectBox
                value={currentModule}
                onChange={(e) => handleModuleChange(e.target.value)}
                disabled={detecting || modulesLoading || slope === null}
                options={[
                  { value: "", label: t("moduleSelectPlaceholder", lang), disabled: true, hidden: true },
                  ...moduleOptions.map((p) => ({ value: p.value, label: p.label })),
                ]}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onPlacePanels("aligned")}
                  disabled={!canPlace || detecting}
                >
                  {t("btnAlignedPlacement", lang)}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onPlacePanels("staggered")}
                  disabled={!canPlace || detecting}
                >
                  {t("btnStaggeredPlacement", lang)}
                </Button>
                <TipPopover>
                  <BaechiTip />
                </TipPopover>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={onDeleteAllPanels}
                disabled={panelCount === 0 || detecting}
              >
                {t("btnDeleteModule", lang)}
              </Button>
              {placementError && (
                <p className="text-[12px] leading-[1.5] text-[#cf2e2e]">
                  {placementError}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <Hint>{t("hintNorthRoofNotRecommended", lang)}</Hint>
              <Hint>{t("hintMixedPanelsNotSupported", lang)}</Hint>
            </div>
          </Section>

          {/* Section 4: ソーラーモジュール設置容量 */}
          <Section
            title={t("installCapacity", lang)}
            iconSrc="/assets/images/contents/tab01_cont_icon04.svg"
            iconWidth={16}
            iconHeight={18}
          >
            <div className="flex items-center justify-center h-[72px] px-4 bg-[#f5f5f5] border border-[#f2f2f2] rounded-[14px]">
              <p className="text-[18px] font-medium leading-[1.5] text-[#101010]">
                {panelCount}{t("capacityUnit", lang)} · {totalKw.toFixed(1).replace(/\.0$/, "")}kW
              </p>
            </div>
          </Section>
          </>}
        </div>
      </div>

      {cropPopupOpen && <div className="flex flex-col gap-2 shrink-0 pb-4">
        <Button
          variant="orange"
          iconPosition="right"
          className="w-full"
          onClick={onPlacementDone}
          disabled={detecting}
          icon={<ChevronRight />}
        >
          {t("modulePlacementDone", lang)}
        </Button>
        <Button
          variant="orange"
          iconPosition="right"
          className="w-full"
          onClick={onSwitchToSimulation}
          disabled={detecting}
          icon={<ChevronRight />}
        >
          {t("simulationCalcInput", lang)}
        </Button>
      </div>}
    </>
  );
}
