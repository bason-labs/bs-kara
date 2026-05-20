'use client';

import { Hash, Tv } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../primitives/SectionHeader';

interface RoomSectionProps {
  code: string;
  isHost: boolean;
}

export function RoomSection({ code, isHost }: RoomSectionProps) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="settings-room">
      <SectionHeader
        id="settings-room"
        Icon={Hash}
        title={t('settings.sections.room')}
      />
      <div className="flex flex-col gap-2">
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
        {isHost && (
          <a
            href={`/tv?room=${code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-border bg-surface-2/40 p-4 flex items-center justify-between gap-3 hover:bg-surface-2/70 transition-colors"
          >
            <span className="text-xs uppercase tracking-[0.22em] text-muted">
              {t('settings.openTv')}
            </span>
            <Tv size={16} className="text-muted" />
          </a>
        )}
      </div>
    </section>
  );
}
