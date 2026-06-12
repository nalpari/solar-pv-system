"use client";

import Image from "next/image";
import { asset } from "../../utils/asset";
import { LnbDesign, type LnbDesignProps } from "./lnb-design";
import { LnbSim, type LnbSimProps } from "./lnb-sim";
import { t, type Lang } from "../../utils/i18n";

export type LnbTab = "design" | "simulation";

interface LnbProps {
  tab: LnbTab;
  lang: Lang;
  design: LnbDesignProps;
  sim: LnbSimProps;
}

export function Lnb({ tab, lang, design, sim }: LnbProps) {
  return (
    <aside
      className="w-[360px] h-screen flex flex-col px-6 pt-6 bg-[#ededed] shrink-0"
      style={{ fontFamily: 'var(--font-noto-sans-jp), system-ui, sans-serif' }}
    >
      <header className="flex items-center justify-center pt-[10px] pb-[20px] shrink-0">
        <Image
          src={asset("/assets/images/common/pv_logo.svg")}
          alt={t("pvLogoAlt", lang)}
          width={254}
          height={30}
          priority
        />
      </header>

      <div className="flex-1 flex flex-col gap-[28px] min-h-0">
        <nav className="flex pt-[18px] shrink-0">
          <TabItem
            active={tab === "design"}
            label={t("tabSolarDesignShort", lang)}
            iconSrc={asset("/assets/images/contents/tab_icon01.svg")}
            iconWidth={18}
            iconHeight={18}
          />
          <TabItem
            active={tab === "simulation"}
            label={t("tabSimulationShort", lang)}
            iconSrc={asset("/assets/images/contents/tab_icon02.svg")}
            iconWidth={16}
            iconHeight={16}
          />
        </nav>

        {tab === "design" ? (
          <LnbDesign {...design} lang={lang} />
        ) : (
          <LnbSim {...sim} lang={lang} />
        )}
      </div>
    </aside>
  );
}

function TabItem({
  active = false,
  label,
  iconSrc,
  iconWidth,
  iconHeight,
}: {
  active?: boolean;
  label: string;
  iconSrc: string;
  iconWidth: number;
  iconHeight: number;
}) {
  const color = active ? "#e74" : "#767676";
  // 단계 표시는 시각 강조용 — 사용자 클릭으로 단계 전환되지 않음
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-2 pb-5 border-b-2 cursor-default"
      style={{ borderColor: color }}
    >
      <span
        className="flex items-center justify-center size-[34px] rounded-full"
        style={{ backgroundColor: color }}
      >
        <Image src={iconSrc} alt="" width={iconWidth} height={iconHeight} />
      </span>
      <span
        className={`text-[13px] leading-[1.5] ${active ? "font-medium" : "font-normal"}`}
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}
