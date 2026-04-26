'use client';

import PlayOutline from 'react-ionicons/lib/PlayOutline';
import PauseOutline from 'react-ionicons/lib/PauseOutline';
import PlaySkipForwardOutline from 'react-ionicons/lib/PlaySkipForwardOutline';
import PlaySkipBackOutline from 'react-ionicons/lib/PlaySkipBackOutline';
import VolumeHighOutline from 'react-ionicons/lib/VolumeHighOutline';
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
  return (
    <div className="shrink-0 bg-black/80 backdrop-blur-sm px-3 py-2.5">
      <div className="flex items-center gap-2">
        {/* Playback buttons */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onTogglePlayPause}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-90 transition-all"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <PauseOutline color="#ffffff" width="20px" height="20px" />
            ) : (
              <PlayOutline color="#ffffff" width="20px" height="20px" />
            )}
          </button>

          <button
            onClick={onPrev}
            disabled={!hasHistory}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90 transition-all disabled:opacity-30"
            aria-label="Previous"
          >
            <PlaySkipBackOutline color="#ffffff" width="20px" height="20px" />
          </button>

          <button
            onClick={onNext}
            disabled={!hasQueue}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90 transition-all disabled:opacity-30"
            aria-label="Next"
          >
            <PlaySkipForwardOutline color="#ffffff" width="20px" height="20px" />
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <VolumeHighOutline color="#ffffff" width="18px" height="18px" />
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer accent-white bg-white/30"
            aria-label="Volume"
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
