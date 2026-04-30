'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Maximize2, Mic, Trash2 } from 'lucide-react';
import { YouTubeVideo } from '@/lib/youtube';

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

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      aria-hidden={!open}
      className={`fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4 lg:p-8 transition-opacity duration-200 ${
        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <button
        type="button"
        aria-label={cancelLabel}
        tabIndex={open ? 0 : -1}
        onClick={onCancel}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full lg:max-w-sm rounded-3xl bg-surface border border-border shadow-2xl p-5 transition-transform duration-200 ${
          open ? 'translate-y-0 scale-100' : 'translate-y-4 lg:translate-y-0 lg:scale-95'
        }`}
      >
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">{message}</p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-full text-sm font-medium text-muted hover:text-fg hover:bg-surface-2 transition-colors active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-danger hover:opacity-90 shadow active:scale-95 transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
