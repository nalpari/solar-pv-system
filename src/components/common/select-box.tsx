import Image from "next/image";
import { Tooltip } from "./tooltip";

export type SelectBoxOption = {
  value: string;
  label: string;
  disabled?: boolean;
  hidden?: boolean;
};

type SelectBoxProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> & {
  options: SelectBoxOption[];
  /** 비활성 시 호버 안내문구(툴팁). disabled 인 native select 는 이벤트가 안 뜨므로 wrapper 에 건다. */
  disabledTitle?: string;
};

export function SelectBox({
  options,
  className,
  disabledTitle,
  ...selectProps
}: SelectBoxProps) {
  const disabled = Boolean(selectProps.disabled);
  const showTooltip = disabled && Boolean(disabledTitle);

  const box = (
    <div
      // 비활성: 배경 회색(#F0F2F5) + not-allowed 커서 / 활성: 흰 배경
      className={`relative flex items-center h-[42px] border rounded-[4px] transition-colors ${
        disabled
          ? "bg-[#f0f2f5] border-[#eff4f8] cursor-not-allowed"
          : "bg-white border-[#eff4f8] hover:border-[#c2d1e5] focus-within:border-[#c2d1e5]"
      } ${showTooltip ? "w-full" : className ?? ""}`}
    >
      <select
        {...selectProps}
        className={`flex-1 min-w-0 h-full pl-4 pr-12 py-0 bg-transparent border-0 rounded-none text-[13px] leading-[1.5] text-[#333] text-ellipsis whitespace-nowrap overflow-hidden outline-none appearance-none shadow-none focus:shadow-none focus:outline-none focus:border-0 ${
          disabled ? "pointer-events-none cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled} hidden={opt.hidden}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="absolute right-0 top-0 bottom-0 flex items-center justify-center w-12 pointer-events-none">
        <Image
          src="/assets/images/common/select_arr.svg"
          alt=""
          width={12}
          height={7}
        />
      </span>
    </div>
  );

  // 비활성 + 안내문구 → 검정 반투명 툴팁으로 감쌈 (내부 select 는 pointer-events 차단됨)
  if (showTooltip) {
    return (
      <Tooltip text={disabledTitle} className={`w-full ${className ?? ""}`}>
        {box}
      </Tooltip>
    );
  }
  return box;
}
