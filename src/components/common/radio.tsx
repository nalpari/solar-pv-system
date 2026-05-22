type RadioProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: React.ReactNode;
};

export function Radio({ label, className, ...inputProps }: RadioProps) {
  return (
    <label
      className={`inline-flex items-center gap-2 h-5 cursor-pointer ${
        className ?? ""
      }`}
    >
      <input
        {...inputProps}
        type="radio"
        className="peer sr-only"
      />
      <span className="relative size-5 shrink-0 bg-white border border-[#e1e3e6] rounded-full transition-colors peer-checked:border-[#1060b4] peer-checked:[&>span]:opacity-100">
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-2 bg-[#36a] rounded-full opacity-0" />
      </span>
      {label !== undefined && (
        <span className="text-[13px] leading-[1.5] text-[#767676] truncate peer-checked:text-[#1060b4]">
          {label}
        </span>
      )}
    </label>
  );
}
