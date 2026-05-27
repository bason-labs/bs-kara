'use client';

import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TransportControlsProps {
  isPlaying: boolean;
  hasHistory: boolean;
  hasQueue: boolean;
  // Receives the current isPlaying so callers can pass the underlying
  // mutator directly (stable reference) instead of wrapping it in an
  // inline arrow that closes over isPlaying.
  onTogglePlayPause: (current: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function TransportControls({
  isPlaying,
  hasHistory,
  hasQueue,
  onTogglePlayPause,
  onPrev,
  onNext,
}: TransportControlsProps) {
  const { t } = useTranslation();
  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasHistory}
        aria-label={t('controls.previousLabel')}
        className="w-11 h-11 flex items-center justify-center rounded-full bg-surface-2 text-fg hover:bg-glow/20 active:scale-90 transition-all disabled:opacity-30 disabled:hover:bg-surface-2"
      >
        <SkipBack size={20} strokeWidth={2.2} fill="currentColor" />
      </button>

      <button
        type="button"
        onClick={() => onTogglePlayPause(isPlaying)}
        aria-label={isPlaying ? t('controls.pauseLabel') : t('controls.playLabel')}
        className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-brand text-white shadow-glow active:scale-95 transition-transform"
      >
        {isPlaying ? (
          <Pause size={28} strokeWidth={2.4} fill="currentColor" />
        ) : (
          <Play
            size={28}
            strokeWidth={2.4}
            fill="currentColor"
            className="translate-x-0.5"
          />
        )}
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={!hasQueue}
        aria-label={t('controls.nextLabel')}
        className="w-11 h-11 flex items-center justify-center rounded-full bg-surface-2 text-fg hover:bg-glow/20 active:scale-90 transition-all disabled:opacity-30 disabled:hover:bg-surface-2"
      >
        <SkipForward size={20} strokeWidth={2.2} fill="currentColor" />
      </button>
    </>
  );
}
