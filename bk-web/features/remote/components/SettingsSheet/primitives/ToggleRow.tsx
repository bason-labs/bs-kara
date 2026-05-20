'use client';

import type { Shuffle } from 'lucide-react';

interface ToggleRowProps {
  label: string;
  hint: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  Icon?: typeof Shuffle;
}

export function ToggleRow({ label, hint, enabled, onToggle, Icon }: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      aria-pressed={enabled}
      className="w-full flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2/40 p-4 text-left active:scale-[0.99] transition-transform hover:border-glow/30"
    >
      <span className="flex flex-col min-w-0 pr-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-fg leading-tight">
          {Icon && <Icon size={14} strokeWidth={2.2} className="text-muted" />}
          {label}
        </span>
        <span className="text-xs leading-relaxed text-muted mt-1">{hint}</span>
      </span>

      <span
        aria-hidden
        className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
          enabled ? 'bg-gradient-brand' : 'bg-surface-2 border border-border'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}
