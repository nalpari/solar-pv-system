"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};

export function TipPopover({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const updatePos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ left: rect.left + rect.width / 2, top: rect.top });
  };

  const handleEnter = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    updatePos();
    setOpen(true);
  };

  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex shrink-0"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <Image
        src={
          open
            ? "/assets/images/contents/tooltip_on.svg"
            : "/assets/images/contents/tooltip.svg"
        }
        alt="tip"
        width={16}
        height={16}
      />
      {mounted &&
        createPortal(
          <div
            className={`fixed z-[100] pb-3 transition-opacity duration-200 ${
              open && pos ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            style={{
              left: pos?.left ?? 0,
              top: pos?.top ?? 0,
              transform: "translate(-50%, -100%)",
            }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
          >
            {children ?? <HouseTip />}
          </div>,
          document.body,
        )}
    </span>
  );
}

function HouseTip() {
  return (
    <div className="relative w-[338px] bg-white border border-[#36a] rounded-[4px] px-[18px] py-[24px]">
      <span className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 block size-2 bg-white border-b border-l border-[#36a] rotate-[-45deg]" />
      <div className="flex gap-3 items-end justify-center">
        <RoofItem
          src="/assets/images/contents/tooltip_cont01.svg"
          width={76}
          height={48}
          label="緩やかな屋根(約3寸)"
        />
        <RoofItem
          src="/assets/images/contents/tooltip_cont02.svg"
          width={75}
          height={48}
          label="標準屋根(約4寸)"
        />
        <RoofItem
          src="/assets/images/contents/tooltip_cont03.svg"
          width={77}
          height={48}
          label="やや急な屋根(約6寸)"
        />
      </div>
    </div>
  );
}

function RoofItem({
  src,
  width,
  height,
  label,
}: {
  src: string;
  width: number;
  height: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Image src={src} alt="" width={width} height={height} />
      <p className="text-[11px] leading-normal text-[#333] text-center -tracking-[0.33px] whitespace-nowrap">
        {label}
      </p>
    </div>
  );
}

export function BaechiTip() {
  return (
    <div className="relative w-[222px] bg-white border-2 border-[#36a] rounded-[4px] p-6">
      <span className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 block size-2 bg-white border-b-2 border-l-2 border-[#36a] rotate-[-45deg]" />
      <div className="flex flex-col gap-[18px] items-start">
        <div className="text-[11px] leading-normal text-[#333] -tracking-[0.33px]">
          <p className="font-medium">千鳥配置</p>
          <p>太陽光パネルをレンガのように、</p>
          <p>一列ずつずらして並べる方法</p>
        </div>
        <Image
          src="/assets/images/contents/baechi_tip.svg"
          alt=""
          width={174}
          height={80}
        />
      </div>
    </div>
  );
}
