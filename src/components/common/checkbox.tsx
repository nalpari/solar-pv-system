type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: React.ReactNode;
};

export function Checkbox({
  label,
  className,
  ...inputProps
}: CheckboxProps) {
  return (
    <label
      className={`inline-flex items-center gap-2 h-5 cursor-pointer ${
        className ?? ""
      }`}
    >
      <input
        {...inputProps}
        type="checkbox"
        className="peer sr-only"
      />
      <span
        className="grid place-items-center size-5 shrink-0 bg-white border border-[#e1e3e6] rounded-[4px] transition-colors peer-checked:bg-[#36a] peer-checked:border-[#36a] peer-checked:[&>svg]:opacity-100"
      >
        <svg
          viewBox="0 0 12 9"
          fill="none"
          aria-hidden
          className="w-3 h-[9px] opacity-0"
        >
          <polyline
            points="1,5 4.5,8 11,1.5"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {label !== undefined && (
        <span className="text-[13px] leading-[1.5] text-[#767676] truncate peer-checked:text-[#36a]">
          {label}
        </span>
      )}
    </label>
  );
}
