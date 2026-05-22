'use client';

import Image from 'next/image';
import { Check, Sparkles, Undo, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { YouTubeVideo } from '@bs-kara/shared';

interface AddedToastProps {
  song: (YouTubeVideo & { queueId: string; queuePos: number }) | null;
  onUndo: (queueId: string) => void;
  onViewQueue: () => void;
}

export function AddedToast({ song, onUndo, onViewQueue }: AddedToastProps) {
  const { t } = useTranslation();

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={`fixed left-4 right-4 bottom-[84px] z-20 transition-all duration-300 ${
        song
          ? 'opacity-100 translate-y-0 animate-toast-in'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      {song && (
        <div className="grid grid-cols-[auto_1fr_auto] gap-3 p-3 bg-surface border border-border rounded-[14px] shadow-[0_18px_36px_-10px_rgba(0,0,0,0.55)] shadow-glow">
          {/* Column 1 — Thumbnail */}
          <div className="relative w-11 h-11 flex-shrink-0">
            <Image
              src={song.thumbnail}
              alt=""
              fill
              className="object-cover rounded-[10px]"
              unoptimized
            />
            {/* Check badge */}
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent text-[#001a1a] border-2 border-surface flex items-center justify-center">
              <Check size={11} strokeWidth={3} />
            </span>
          </div>

          {/* Column 2 — Meta */}
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1 mb-0.5">
              <Sparkles size={11} className="text-accent flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                {t('toast.queuePosition', { pos: song.queuePos })}
              </span>
            </div>
            <p className="text-[13px] font-medium text-fg truncate">{song.title}</p>
          </div>

          {/* Column 3 — Actions */}
          <div className="flex flex-col items-end justify-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => onUndo(song.queueId)}
              className="flex items-center gap-1 text-[12px] font-semibold text-muted bg-transparent"
            >
              <Undo size={14} />
              {t('toast.undo')}
            </button>
            <button
              type="button"
              onClick={onViewQueue}
              className="flex items-center gap-1 text-[12px] font-semibold text-fg bg-surface-2 border border-border rounded-full px-2 py-1"
            >
              {t('toast.viewQueue')}
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
