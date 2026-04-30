'use client';

import { Play, Pause, SkipForward, SkipBack, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { YouTubeVideo } from '@/lib/youtube';

interface RemoteControlsProps {
  isPlaying: boolean;
  volume: number;
  hasHistory: boolean;
  hasQueue: boolean;
  currentPlaying: YouTubeVideo | null;
  onTogglePlayPause: () => void;
  onVolumeChange: (vol: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function RemoteControls({
  isPlaying,
  volume,
  hasHistory,
  hasQueue,
  currentPlaying,
  onTogglePlayPause,
  onVolumeChange,
  onPrev,
  onNext,
}: RemoteControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="shrink-0 border-t border-border/60 px-3 py-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onPrev}
          disabled={!hasHistory}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-2 text-fg hover:bg-glow/20 active:scale-90 transition-all disabled:opacity-30 disabled:hover:bg-surface-2"
          aria-label={t('controls.previousLabel')}
        >
          <SkipBack size={18} strokeWidth={2.2} />
        </button>

        <button
          onClick={onTogglePlayPause}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-brand text-white shadow-glow active:scale-95 transition-transform"
          aria-label={isPlaying ? t('controls.pauseLabel') : t('controls.playLabel')}
        >
          {isPlaying ? <Pause size={22} strokeWidth={2.4} fill="currentColor" /> : <Play size={22} strokeWidth={2.4} fill="currentColor" />}
        </button>

        <button
          onClick={onNext}
          disabled={!hasQueue}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-2 text-fg hover:bg-glow/20 active:scale-90 transition-all disabled:opacity-30 disabled:hover:bg-surface-2"
          aria-label={t('controls.nextLabel')}
        >
          <SkipForward size={18} strokeWidth={2.2} />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0 ml-1">
          <Volume2 size={18} className="text-muted" />
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer bg-border accent-glow"
            aria-label={t('controls.volumeLabel')}
          />
        </div>

        {currentPlaying?.duration && (
          <span className="tabular text-xs text-muted shrink-0">
            {currentPlaying.duration}
          </span>
        )}
      </div>
    </div>
  );
}
