"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { Button, SelectBox } from "@/components/common";
import { ChevronRight, Hint, Section } from "./section";
import { BaechiTip, TipPopover } from "./tip-popover";
import { AddressInputLnb } from "./address-input-lnb";
import { t, type Lang } from "../../utils/i18n";
import type { PanelSize } from "../../types";

// 5단계 경사 옵션 — value는 寸 숫자, label은 풍부 텍스트(명세)
const SLOPE_OPTIONS: { value: number; labelKey: "slopeLabel1" | "slopeLabel3" | "slopeLabel4" | "slopeLabel6" | "slopeLabel8" }[] = [
  { value: 1, labelKey: "slopeLabel1" },
  { value: 3, labelKey: "slopeLabel3" },
  { value: 4, labelKey: "slopeLabel4" },
  { value: 6, labelKey: "slopeLabel6" },
  { value: 8, labelKey: "slopeLabel8" },
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
  /** 모듈 선택 시 matlCd(SimulationInput.moduleItemId) 전달 — 시뮬 API 입력용 */
  onModuleSelect?: (moduleId: string) => void;
  // Results
  panelCount: number;
  canPlace: boolean;
  placementError: string | null;
  onPlacePanels: (layout: "aligned" | "staggered") => void;
  onDeleteAllPanels: () => void;
  /** 모듈 변경 시 기존 배치 모듈 전체 삭제 (선택 여부 무관) */
  onClearAllPanels: () => void;
  // Detect state
  detectStatus: "idle" | "detecting";
  // Bottom CTAs
  /** 모듈 배치 완료(편집 잠금) 상태 — true면 경사·모듈·배치·편집 비활성, 발전시뮬 버튼 활성 */
  isPlacementDone: boolean;
  onPlacementDone?: () => void; // ③ 버튼 토글 (배치완료 ↔ 편집으로 돌아가기)
  onSwitchToSimulation: () => void; // ④ 발전 시뮬레이션 입력 단계로
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
  onModuleSelect,
  panelCount,
  canPlace,
  placementError,
  onPlacePanels,
  onDeleteAllPanels,
  onClearAllPanels,
  detectStatus,
  isPlacementDone,
  onPlacementDone,
  onSwitchToSimulation,
}: LnbDesignProps) {
  const detecting = detectStatus === "detecting";

  const [moduleOptions, setModuleOptions] = useState<{ value: string; label: string; size: PanelSize }[]>([]);
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
            wpOut: string;
            shortAxis: number;
            longAxis: number;
          }>;
          const modules = items
            // 출력(wpOut) 없는/0 모듈은 제외 — 용량이 0kW로 잘못 표시되는 것 방지
            .filter((item) => item.matlGbnCd === "M" && Number(item.wpOut) > 0)
            .map((item) => ({
              value: item.matlCd,
              label: item.qcastCustPrdNm,
              size: {
                label: item.qcastCustPrdNm,
                width: item.shortAxis,
                height: item.longAxis,
                watt: Number(item.wpOut) || 0,
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
      // value=matlCd(moduleItemId) — QSP 카탈로그 로드 성공 시에만 옵션이 채워지므로 항상 실 ID
      onModuleSelect?.(value);
      onClearAllPanels(); // 모듈 변경 시 기존 배치 모듈 전체 삭제 (선택 여부 무관)
    }
  }

  // 설치 용량 = Σ(모듈 수 × wpOut[W]) → kW. 부동소수 꼬리만 정리
  const totalKw = parseFloat(((panelCount * (panelSize?.watt ?? 0)) / 1000).toFixed(3));

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
              disabled={detecting || areaCount === 0 || isPlacementDone}
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
                disabled={detecting || modulesLoading || slope === null || isPlacementDone}
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
                  disabled={!canPlace || detecting || isPlacementDone}
                >
                  {t("btnAlignedPlacement", lang)}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onPlacePanels("staggered")}
                  disabled={!canPlace || detecting || isPlacementDone}
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
                disabled={panelCount === 0 || detecting || isPlacementDone}
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
                {panelCount}{t("capacityUnit", lang)} · {totalKw}kW
              </p>
            </div>
          </Section>
          </>}
        </div>
      </div>

      {cropPopupOpen && <div className="flex flex-col gap-2 shrink-0 pb-4">
        {/* ③ 토글: 모듈 배치 완료 ↔ 모듈 편집으로 돌아가기 (모듈 1개+ 배치 시 활성화) */}
        <Button
          variant="orange"
          iconPosition="right"
          className="w-full"
          onClick={onPlacementDone}
          disabled={detecting || panelCount === 0}
          icon={<ChevronRight />}
        >
          {t(isPlacementDone ? "moduleEditReturn" : "modulePlacementDone", lang)}
        </Button>
        {/* ④ 발전 시뮬레이션 입력 — ③이 '편집으로 돌아가기' 상태(isPlacementDone)일 때만 활성 */}
        <Button
          variant="orange"
          iconPosition="right"
          className="w-full"
          onClick={onSwitchToSimulation}
          disabled={detecting || !isPlacementDone}
          icon={<ChevronRight />}
        >
          {t("simulationCalcInput", lang)}
        </Button>
      </div>}
    </>
  );
}
