import Image from "next/image";
import { TipPopover } from "./tip-popover";

export function Section({
  title,
  iconSrc,
  iconWidth,
  iconHeight,
  tip = false,
  children,
}: {
  title: string;
  iconSrc: string;
  iconWidth: number;
  iconHeight: number;
  tip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 py-3.5">
      <header className="flex items-center gap-2">
        <span className="flex items-center justify-center size-[34px] bg-[#f5f7fb] rounded-full">
          <Image src={iconSrc} alt="" width={iconWidth} height={iconHeight} />
        </span>
        <h2 className="flex-1 text-[14px] font-medium leading-[1.5] text-[#101010]">
          {title}
        </h2>
        {tip && <TipPopover />}
      </header>
      {children}
    </section>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] leading-[1.5] text-[#999]">{children}</p>;
}

export function ChevronRight() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
