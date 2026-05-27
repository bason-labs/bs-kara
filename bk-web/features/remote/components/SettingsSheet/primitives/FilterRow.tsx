'use client';

interface FilterRowProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function FilterRow({
  label,
  value,
  options,
  onChange,
  disabled,
}: FilterRowProps) {
  return (
    <div
      className={`flex flex-col gap-2 transition-opacity ${
        disabled ? 'opacity-40 pointer-events-none' : ''
      }`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          // Active and inactive pills both carry a 1px border. The active
          // border is transparent so it occupies the same box as the
          // bordered inactive variant — switching selection no longer
          // shifts neighbouring pill positions.
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={disabled || undefined}
              onClick={() => onChange(opt.value)}
              className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide whitespace-nowrap border transition-colors active:scale-95 ${
                active
                  ? 'bg-gradient-brand text-white border-transparent shadow-glow'
                  : 'bg-surface text-muted border-border hover:text-fg hover:border-glow/40'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
