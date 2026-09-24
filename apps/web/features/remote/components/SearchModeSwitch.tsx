'use client';

import { AudioLines, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SearchMode } from '../hooks/useSearchModeParam';

export function SearchModeSwitch({ mode, onChange }: { mode: SearchMode; onChange: (mode: SearchMode) => void }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('voiceChat.modeLabel')} className="mx-4 mt-3 mb-2 grid grid-cols-2 rounded-lg bg-surface-2 p-1">
      {(['manual', 'voice'] as const).map(value => {
        const Icon = value === 'manual' ? Search : AudioLines;
        return <button key={value} type="button" aria-pressed={mode === value} onClick={() => onChange(value)} className={`min-h-11 flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors ${mode === value ? 'bg-surface text-brand dark:text-accent shadow-sm' : 'text-muted'}`}><Icon size={18} aria-hidden />{t(`voiceChat.${value}`)}</button>;
      })}
    </div>
  );
}
