'use client';

import { Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../primitives/SectionHeader';

export function RoomSection({ code }: { code: string }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="settings-room">
      <SectionHeader
        id="settings-room"
        Icon={Hash}
        title={t('settings.sections.room')}
      />
      <div className="rounded-2xl border border-border bg-surface-2/40 p-4 flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.22em] text-muted">
          {t('settings.roomCodeLabel')}
        </span>
        <span
          className="tabular px-3.5 py-1.5 text-sm font-bold text-white bg-gradient-brand rounded-full tracking-[0.3em] shadow-glow"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {code}
        </span>
      </div>
    </section>
  );
}
