'use client';

import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type AddedToastSong = {
  title: string;
  thumbnail: string;
};

type AddedToastProps = {
  song: AddedToastSong | null;
  onViewQueue: () => void;
  onDismiss: () => void;
};

export function AddedToast({ song, onViewQueue, onDismiss }: AddedToastProps) {
  const { t } = useTranslation();
  const visible = song !== null;

  return (
    <div
      aria-live="polite"
      role="status"
      className={`lg:hidden pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.25rem)' }}
    >
      {song && (
        <div
          onClick={onDismiss}
          className="pointer-events-auto w-full max-w-sm flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-surface text-fg border border-border shadow-glow"
        >
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
            <Image
              src={song.thumbnail}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand">
              <CheckCircle2 size={12} />
              {t('toast.addedToQueue')}
            </div>
            <p className="text-sm text-fg truncate">{song.title}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewQueue();
            }}
            className="shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-brand rounded-full"
          >
            {t('toast.viewQueue')}
          </button>
        </div>
      )}
    </div>
  );
}
