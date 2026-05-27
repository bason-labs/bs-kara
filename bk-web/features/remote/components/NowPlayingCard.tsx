'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Maximize2, Mic, Trash2 } from 'lucide-react';
import { YouTubeVideo } from '@bs-kara/shared';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface NowPlayingCardProps {
  track: YouTubeVideo | null;
  isPlaying?: boolean;
  onExpand?: () => void;
  onRemove?: () => void;
  className?: string;
  /**
   * `compact` (default) — horizontal card with thumbnail beside the title.
   * Used in the desktop right column and as a slim header in places that
   * need a remote-style strip.
   *
   * `hero` — large centered album-art layout used on the mobile player tab
   * so the screen doesn't feel empty between the now-playing strip and the
   * transport controls.
   */
  variant?: 'compact' | 'hero';
}

export function NowPlayingCard({
  track,
  isPlaying = true,
  onExpand,
  onRemove,
  className = '',
  variant = 'compact',
}: NowPlayingCardProps) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (!track) return null;

  const equalizerStyle = (
    <style>{`
      .now-eq i {
        display: block;
        width: 3px;
        background: var(--glow);
        border-radius: 2px;
        height: 30%;
        transform-origin: bottom;
      }
      .now-eq[data-playing='true'] i {
        animation: nowEq 0.9s ease-in-out infinite;
      }
      .now-eq[data-playing='true'] i:nth-child(2) {
        animation-delay: 0.15s;
      }
      .now-eq[data-playing='true'] i:nth-child(3) {
        animation-delay: 0.3s;
      }
      @keyframes nowEq {
        0%, 100% { transform: scaleY(0.4); }
        50% { transform: scaleY(1); }
      }
    `}</style>
  );

  const confirmDialog = onRemove ? (
    <ConfirmDialog
      open={confirmOpen}
      title={t('nowPlaying.removeConfirm.title')}
      message={t('nowPlaying.removeConfirm.message')}
      confirmLabel={t('nowPlaying.removeConfirm.confirm')}
      cancelLabel={t('nowPlaying.removeConfirm.cancel')}
      onConfirm={() => {
        setConfirmOpen(false);
        onRemove();
      }}
      onCancel={() => setConfirmOpen(false)}
    />
  ) : null;

  if (variant === 'hero') {
    return (
      <>
        <div
          className={`flex flex-col items-center text-center gap-4 px-6 ${className}`}
        >
          <div
            onClick={onExpand}
            className={`relative w-full max-w-[320px] aspect-video rounded-3xl overflow-hidden border border-glow/40 bg-gradient-to-br from-surface-2 to-surface shadow-glow ring-1 ring-glow/30 ${
              onExpand ? 'cursor-pointer transition-transform active:scale-[0.98]' : ''
            }`}
          >
            <Image
              src={track.thumbnail}
              alt={track.title}
              fill
              className="object-cover"
              unoptimized
            />
            <div
              aria-hidden="true"
              data-playing={isPlaying ? 'true' : 'false'}
              className="now-eq absolute bottom-2 left-2 flex items-end gap-0.5 h-5 w-7 rounded-md bg-black/55 backdrop-blur-sm px-1 py-0.5"
            >
              <i />
              <i />
              <i />
            </div>
            {onExpand && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand();
                }}
                aria-label={t('player.openFullscreen')}
                className="absolute top-2 right-2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/55 backdrop-blur text-glow hover:text-fg active:scale-95 transition"
              >
                <Maximize2 size={16} />
              </button>
            )}
          </div>

          <div className="min-w-0 max-w-[320px] flex flex-col items-center gap-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-glow font-semibold">
              {t('nowPlaying.label')}
            </p>
            <p
              title={track.title}
              className="text-base sm:text-lg font-semibold text-fg line-clamp-2 leading-snug"
            >
              {track.title}
            </p>
            <p className="text-xs text-muted truncate max-w-full">{track.channel}</p>
            {track.requesterName && (
              <span className="mt-1 inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full bg-glow/15 text-glow text-[11px] font-medium">
                <Mic size={10} className="shrink-0" />
                <span className="truncate">{track.requesterName}</span>
              </span>
            )}
          </div>

          {onRemove && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              aria-label={t('nowPlaying.removeAriaLabel')}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-danger px-3 py-1.5 rounded-full bg-surface/60 hover:bg-surface transition"
            >
              <Trash2 size={14} />
              <span>{t('nowPlaying.removeAriaLabel')}</span>
            </button>
          )}

          {equalizerStyle}
        </div>
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      <div
        onClick={onExpand}
        className={`relative flex items-center gap-3 rounded-2xl border border-glow/40 bg-gradient-to-br from-surface-2 to-surface p-3 shadow-glow ${onExpand ? 'cursor-pointer transition-transform active:scale-[0.99]' : ''} ${className}`}
      >
        <div className="relative w-24 h-16 lg:w-28 lg:h-[72px] shrink-0 rounded-xl overflow-hidden bg-surface ring-1 ring-glow/30">
          <Image
            src={track.thumbnail}
            alt={track.title}
            fill
            className="object-cover"
            unoptimized
          />
          <div
            aria-hidden="true"
            data-playing={isPlaying ? 'true' : 'false'}
            className="now-eq absolute bottom-1 left-1 flex items-end gap-0.5 h-4 w-5 rounded-md bg-black/55 backdrop-blur-sm px-1 py-0.5"
          >
            <i />
            <i />
            <i />
          </div>
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-glow font-semibold">
              {t('nowPlaying.label')}
            </p>
            <p
              title={track.title}
              className="mt-0.5 text-sm font-semibold text-fg line-clamp-2 leading-snug"
            >
              {track.title}
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
            <p className="text-xs text-muted truncate min-w-0 flex-shrink">
              {track.channel}
            </p>
            {track.requesterName && (
              <span className="inline-flex items-center gap-1 max-w-full lg:max-w-[55%] px-1.5 py-0.5 rounded-full bg-glow/15 text-glow text-[11px] font-medium">
                <Mic size={10} className="shrink-0" />
                <span className="lg:truncate">{track.requesterName}</span>
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-center justify-center gap-1">
          {onExpand && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              aria-label={t('player.openFullscreen')}
              className="p-2 rounded-lg text-glow bg-glow/10 hover:bg-glow/20 hover:text-fg transition-colors"
            >
              <Maximize2 size={16} />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmOpen(true);
              }}
              aria-label={t('nowPlaying.removeAriaLabel')}
              className="p-2 rounded-lg text-muted hover:text-danger hover:bg-surface transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {equalizerStyle}
      </div>

      {confirmDialog}
    </>
  );
}

