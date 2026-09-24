'use client';

import { Laptop, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ThemePreference, useTheme } from '@/components/ThemeProvider';

const OPTIONS: { value: ThemePreference; Icon: typeof Sun; labelKey: string }[] = [
  { value: 'light', Icon: Sun, labelKey: 'theme.light' },
  { value: 'system', Icon: Laptop, labelKey: 'theme.system' },
  { value: 'dark', Icon: Moon, labelKey: 'theme.dark' },
];

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label={t('theme.label')}
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-full bg-surface-2 border border-border ${className}`}
    >
      {OPTIONS.map(({ value, Icon, labelKey }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            onClick={() => setPreference(value)}
            className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors cursor-pointer ${
              active
                ? 'bg-gradient-brand text-white shadow-glow'
                : 'text-muted hover:text-fg'
            }`}
          >
            <Icon size={14} strokeWidth={2.2} />
          </button>
        );
      })}
    </div>
  );
}
