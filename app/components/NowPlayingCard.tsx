'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Maximize2, Mic, Trash2 } from 'lucide-react';
import { YouTubeVideo } from '@/lib/youtube';
import { ConfirmDialog } from './ConfirmDialog';

interface NowPlayingCardProps {
  track: YouTubeVideo | null;
  isPlaying?: boolean;
  onExpand?: () => void;
  onRemove?: () => void;
  className?: string;
}

export function NowPlayingCard({
  track,
  isPlaying = true,
  onExpand,
  onRemove,
  className = '',
}: NowPlayingCardProps) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (!track) return null;

  return (
    <>
      <div
        className={`relative flex items-stretch gap-3 rounded-2xl border border-glow/40 bg-gradient-to-br from-surface-2 to-surface p-3 shadow-glow ${className}`}
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

        <div className="shrink-0 flex flex-col items-center justify-between gap-1">
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              aria-label={t('player.openFullscreen')}
              className="p-2 rounded-lg text-glow bg-glow/10 hover:bg-glow/20 hover:text-fg transition-colors"
            >
              <Maximize2 size={16} />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              aria-label={t('nowPlaying.removeAriaLabel')}
              className="p-2 rounded-lg text-muted hover:text-danger hover:bg-surface transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

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
      </div>

      {onRemove && (
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
      )}
    </>
  );
}

