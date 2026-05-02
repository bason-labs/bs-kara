'use client';

import { useEffect, useRef } from 'react';

// Watches for the MC-gated → ungated edge. When it fires, the iframe was
// paused throughout the MC announcement and `isPlaying` may have echoed
// false during the mute/pause dance — so we kick playback back on if the
// app isn't already playing. Used by both the TV view and the phone
// fullscreen player; behavior must match across both.
export function useMCKickPlay(
  isMcGated: boolean,
  isPlaying: boolean,
  setPlaying: (next: boolean) => void,
) {
  const wasMcGatedRef = useRef(isMcGated);
  useEffect(() => {
    if (wasMcGatedRef.current && !isMcGated) {
      if (!isPlaying) setPlaying(true);
    }
    wasMcGatedRef.current = isMcGated;
  }, [isMcGated, isPlaying, setPlaying]);
}
