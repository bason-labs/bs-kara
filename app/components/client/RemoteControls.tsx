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
    <div className="shrink-0 bg-black/80 backdrop-blur-sm px-3 py-2.5">
      <div className="flex items-center gap-2">
        {/* Playback buttons */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onTogglePlayPause}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-90 transition-all"
            aria-label={isPlaying ? t('controls.pauseLabel') : t('controls.playLabel')}
          >
            {isPlaying ? (
              <Pause size={20} color="#ffffff" />
            ) : (
              <Play size={20} color="#ffffff" />
            )}
          </button>

          <button
            onClick={onPrev}
            disabled={!hasHistory}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90 transition-all disabled:opacity-30"
            aria-label={t('controls.previousLabel')}
          >
            <SkipBack size={20} color="#ffffff" />
          </button>

          <button
            onClick={onNext}
            disabled={!hasQueue}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90 transition-all disabled:opacity-30"
            aria-label={t('controls.nextLabel')}
          >
            <SkipForward size={20} color="#ffffff" />
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Volume2 size={18} color="#ffffff" />
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer accent-white bg-white/30"
            aria-label={t('controls.volumeLabel')}
          />
        </div>

        {/* Duration */}
        {currentPlaying?.duration && (
          <span className="text-xs text-white/60 tabular-nums shrink-0 ml-1">
            {currentPlaying.duration}
          </span>
        )}
      </div>
    </div>
  );
}
