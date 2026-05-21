import Image from "next/image";

type InputBoxProps = React.InputHTMLAttributes<HTMLInputElement> & {
  withSearchIcon?: boolean;
  onSearchClick?: () => void;
};

export function InputBox({
  withSearchIcon = false,
  onSearchClick,
  className,
  ...inputProps
}: InputBoxProps) {
  return (
    <div
      className={`flex items-center h-[42px] bg-white border border-[#eff4f8] rounded-[4px] overflow-hidden transition-colors hover:border-[#c2d1e5] focus-within:border-[#c2d1e5] ${
        withSearchIcon ? "pl-4" : "px-4"
      } ${className ?? ""}`}
    >
      <input
        {...inputProps}
        className="flex-1 min-w-0 h-full bg-transparent border-0 rounded-none px-0 py-0 text-[13px] leading-[1.5] text-[#333] text-ellipsis placeholder:text-[#333]/40 outline-none shadow-none focus:shadow-none focus:outline-none focus:border-0"
      />
      {withSearchIcon && (
        <button
          type="button"
          onClick={onSearchClick}
          aria-label="검색"
          className="flex items-center justify-center w-12 h-full shrink-0 cursor-pointer"
        >
          <Image
            src="/assets/images/common/search_icon.svg"
            alt=""
            width={17}
            height={17}
          />
        </button>
      )}
    </div>
  );
}
