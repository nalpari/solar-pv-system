import Image from "next/image";

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
};

export function SelectBox({
  options,
  className,
  ...selectProps
}: SelectBoxProps) {
  return (
    <div
      className={`relative flex items-center h-[42px] bg-white border border-[#eff4f8] rounded-[4px] transition-colors hover:border-[#c2d1e5] focus-within:border-[#c2d1e5] ${
        className ?? ""
      }`}
    >
      <select
        {...selectProps}
        className="flex-1 min-w-0 h-full pl-4 pr-12 py-0 bg-transparent border-0 rounded-none text-[13px] leading-[1.5] text-[#333] text-ellipsis whitespace-nowrap overflow-hidden outline-none appearance-none cursor-pointer shadow-none focus:shadow-none focus:outline-none focus:border-0"
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
}
