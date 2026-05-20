'use client';

import { TransportControls } from '@/components/TransportControls';
import { YouTubeVideo } from '@/lib/youtube/types';

interface RemoteControlsProps {
  isPlaying: boolean;
  hasHistory: boolean;
  hasQueue: boolean;
  currentPlaying: YouTubeVideo | null;
  onTogglePlayPause: (current: boolean) => void;
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
  return (
    <div className="shrink-0 border-t border-border/60 px-4 py-4">
      <div className="relative flex items-center justify-center gap-5">
        <TransportControls
          isPlaying={isPlaying}
          hasHistory={hasHistory}
          hasQueue={hasQueue}
          onTogglePlayPause={onTogglePlayPause}
          onPrev={onPrev}
          onNext={onNext}
        />

        {currentPlaying?.duration && (
          <span className="tabular absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted">
            {currentPlaying.duration}
          </span>
        )}
      </div>
    </div>
  );
}
