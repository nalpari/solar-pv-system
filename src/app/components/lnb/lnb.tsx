"use client";

import Image from "next/image";
import { LnbDesign, type LnbDesignProps } from "./lnb-design";
import { LnbSim, type LnbSimProps } from "./lnb-sim";
import { t, type Lang } from "../../utils/i18n";

export type LnbTab = "design" | "simulation";

interface LnbProps {
  tab: LnbTab;
  onTabChange: (tab: LnbTab) => void;
  lang: Lang;
  design: LnbDesignProps;
  sim: LnbSimProps;
}

export function Lnb({ tab, onTabChange, lang, design, sim }: LnbProps) {
  return (
    <aside
      className="w-[360px] h-screen flex flex-col px-6 pt-6 bg-[#ededed] shrink-0"
      style={{ fontFamily: '"Noto Sans JP", var(--font-noto-sans-jp), system-ui, sans-serif' }}
    >
      <header className="flex items-center justify-center pt-[10px] pb-[20px] shrink-0">
        <Image
          src="/assets/images/common/pv_logo.svg"
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
            iconSrc="/assets/images/contents/tab_icon01.svg"
            iconWidth={18}
            iconHeight={18}
            onClick={() => onTabChange("design")}
          />
          <TabItem
            active={tab === "simulation"}
            label={t("tabSimulationShort", lang)}
            iconSrc="/assets/images/contents/tab_icon02.svg"
            iconWidth={16}
            iconHeight={16}
            onClick={() => onTabChange("simulation")}
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
  onClick,
}: {
  active?: boolean;
  label: string;
  iconSrc: string;
  iconWidth: number;
  iconHeight: number;
  onClick?: () => void;
}) {
  const color = active ? "#e74" : "#767676";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-2 pb-5 border-b-2 cursor-pointer bg-transparent"
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
    </button>
  );
}
