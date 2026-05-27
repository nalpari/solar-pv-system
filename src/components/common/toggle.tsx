type ToggleProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "role"
> & {
  label?: React.ReactNode;
};

export function Toggle({ label, className, ...inputProps }: ToggleProps) {
  return (
    <label
      className={`relative inline-flex items-center gap-2 cursor-pointer ${
        className ?? ""
      }`}
    >
      <input
        {...inputProps}
        type="checkbox"
        role="switch"
        className="peer sr-only"
      />
      <span className="block w-[37px] h-5 shrink-0 bg-[#eee] rounded-full transition-colors peer-checked:bg-[#36a]" />
      <span className="absolute top-[1.5px] left-[1.5px] size-[16px] bg-white border-[3px] border-transparent rounded-full transition-all peer-checked:border-white peer-checked:translate-x-[17px]" />
      {label !== undefined && (
        <span className="text-[13px] leading-[1.5] text-[#767676] peer-checked:text-[#36a]">
          {label}
        </span>
      )}
    </label>
  );
}
