'use client';

import { Palette } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '../../ThemeToggle';
import { SectionHeader } from '../primitives/SectionHeader';

export function ThemeSection() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="settings-appearance">
      <SectionHeader
        id="settings-appearance"
        Icon={Palette}
        title={t('settings.sections.appearance')}
      />
      <div className="rounded-2xl border border-border bg-surface-2/40 p-4 flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-muted pr-2 min-w-0">
          {t('settings.themeHint')}
        </p>
        <ThemeToggle />
      </div>
    </section>
  );
}
