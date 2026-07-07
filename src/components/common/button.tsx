import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip } from "./tooltip";

type ButtonVariant = "primary" | "orange" | "orange-outline" | "blue" | "red";
type IconPosition = "left" | "right";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  iconHover?: ReactNode;
  iconPosition?: IconPosition;
  /** 비활성 시 호버 안내문구(툴팁). disabled 버튼은 이벤트가 안 뜨므로 wrapper span 에 건다. */
  disabledTitle?: string;
  /** 툴팁 방향. 스크롤 밖 하단 고정 버튼은 "top" 지정 (기본 아래). */
  tooltipPlacement?: "top" | "bottom";
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "gap-2 px-[18px] bg-[#36a] border border-[#36a] text-white hover:bg-[#1d477e] hover:border-[#1d477e] active:bg-[#0c2648] active:border-[#0c2648]",
  orange:
    "gap-2 px-[18px] bg-[#e74] border border-[#e74] text-white hover:bg-[#d36739] hover:border-[#d36739]",
  "orange-outline":
    "gap-[3px] bg-white border border-[#e74] text-[#e74] hover:bg-[#e74] hover:text-white",
  blue:
    "gap-2 px-[10px] bg-[#3b82f6] border border-[#3b82f6] text-white hover:bg-[#2563eb] hover:border-[#2563eb]",
  red:
    "gap-2 px-[10px] bg-[#ef4444] border border-[#ef4444] text-white hover:bg-[#dc2626] hover:border-[#dc2626]",
};

// 비활성 공통 스타일 — 회색 배경(#F6F8FB) + 흐린 텍스트 + not-allowed 커서 (variant 무관 적용)
const DISABLED_STYLE =
  "gap-2 px-[10px] bg-[#f6f8fb] border border-[#d9e2ef] text-[#adc2dd] cursor-not-allowed";

const BASE_STYLE =
  "group inline-flex items-center justify-center h-[42px] rounded-[4px] text-[13px] font-medium leading-[1.5] transition-colors";

export function Button({
  variant = "primary",
  icon,
  iconHover,
  iconPosition = "left",
  className,
  children,
  type = "button",
  disabled,
  disabledTitle,
  tooltipPlacement,
  ...buttonProps
}: ButtonProps) {
  const iconSlot = (icon || iconHover) && (
    <>
      {icon && (
        <span
          className={`inline-flex shrink-0 ${
            iconHover ? "group-hover:hidden group-active:hidden" : ""
          }`}
        >
          {icon}
        </span>
      )}
      {iconHover && (
        <span className="hidden shrink-0 group-hover:inline-flex group-active:inline-flex">
          {iconHover}
        </span>
      )}
    </>
  );

  const renderButton = (extraClass: string) => (
    <button
      {...buttonProps}
      type={type}
      disabled={disabled}
      className={`${BASE_STYLE} ${
        disabled ? DISABLED_STYLE : `cursor-pointer ${variantStyles[variant]}`
      } ${extraClass}`}
    >
      {iconPosition === "left" && iconSlot}
      {children}
      {iconPosition === "right" && iconSlot}
    </button>
  );

  // 비활성 + 안내문구 → Tooltip(검정 반투명 말풍선)으로 감싸고 버튼은 pointer-events 차단해
  // 호버를 Tooltip 래퍼로 전달 (disabled 버튼 자체는 hover 이벤트가 안 뜨므로).
  if (disabled && disabledTitle) {
    return (
      <Tooltip
        text={disabledTitle}
        placement={tooltipPlacement}
        className={`cursor-not-allowed ${className ?? ""}`}
      >
        {renderButton("w-full pointer-events-none")}
      </Tooltip>
    );
  }

  return renderButton(className ?? "");
}
