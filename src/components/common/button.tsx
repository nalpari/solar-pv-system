import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "outline" | "orange" | "orange-outline";
type IconPosition = "left" | "right";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  iconHover?: ReactNode;
  iconPosition?: IconPosition;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "gap-2 px-[18px] bg-[#36a] border border-[#36a] text-white hover:bg-[#1d477e] hover:border-[#1d477e] active:bg-[#0c2648] active:border-[#0c2648]",
  outline:
    "gap-2 px-[10px] bg-[#f6f8fb] border border-[#d9e2ef] text-[#adc2dd] hover:bg-[#adc2dd] hover:border-[#adc2dd] hover:text-white active:bg-[#36a] active:border-[#36a] active:text-white",
  orange:
    "gap-2 px-[18px] bg-[#e74] border border-[#e74] text-white hover:bg-[#d36739] hover:border-[#d36739]",
  "orange-outline":
    "gap-[3px] bg-white border border-[#e74] text-[#e74] hover:bg-[#e74] hover:text-white",
};

export function Button({
  variant = "primary",
  icon,
  iconHover,
  iconPosition = "left",
  className,
  children,
  type = "button",
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

  return (
    <button
      {...buttonProps}
      type={type}
      className={`group inline-flex items-center justify-center h-[42px] rounded-[4px] text-[13px] font-medium leading-[1.5] cursor-pointer transition-colors ${variantStyles[variant]} ${className ?? ""}`}
    >
      {iconPosition === "left" && iconSlot}
      {children}
      {iconPosition === "right" && iconSlot}
    </button>
  );
}
