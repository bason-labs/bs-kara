'use client';

import { Play, Pause, SkipForward, SkipBack } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { YouTubeVideo } from '@/lib/youtube';

interface RemoteControlsProps {
  isPlaying: boolean;
  hasHistory: boolean;
  hasQueue: boolean;
  currentPlaying: YouTubeVideo | null;
  onTogglePlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function RemoteControls({
  isPlaying,
  hasHistory,
  hasQueue,
  currentPlaying,
  onTogglePlayPause,
  onPrev,
  onNext,
}: RemoteControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="shrink-0 border-t border-border/60 px-4 py-4">
      <div className="relative flex items-center justify-center gap-5">
        <button
          onClick={onPrev}
          disabled={!hasHistory}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-surface-2 text-fg hover:bg-glow/20 active:scale-90 transition-all disabled:opacity-30 disabled:hover:bg-surface-2"
          aria-label={t('controls.previousLabel')}
        >
          <SkipBack size={20} strokeWidth={2.2} fill="currentColor" />
        </button>

        <button
          onClick={onTogglePlayPause}
          className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-brand text-white shadow-glow active:scale-95 transition-transform"
          aria-label={isPlaying ? t('controls.pauseLabel') : t('controls.playLabel')}
        >
          {isPlaying ? (
            <Pause size={28} strokeWidth={2.4} fill="currentColor" />
          ) : (
            <Play size={28} strokeWidth={2.4} fill="currentColor" className="translate-x-0.5" />
          )}
        </button>

        <button
          onClick={onNext}
          disabled={!hasQueue}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-surface-2 text-fg hover:bg-glow/20 active:scale-90 transition-all disabled:opacity-30 disabled:hover:bg-surface-2"
          aria-label={t('controls.nextLabel')}
        >
          <SkipForward size={20} strokeWidth={2.2} fill="currentColor" />
        </button>

        {currentPlaying?.duration && (
          <span className="tabular absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted">
            {currentPlaying.duration}
          </span>
        )}
      </div>
    </div>
  );
}
