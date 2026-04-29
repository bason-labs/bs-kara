'use client';

import { useCallback, useEffect, useRef } from 'react';
import { searchYouTube } from '@/lib/youtube';
import type { RandomFilters, YouTubeVideo } from '@/lib/youtube';
import {
  buildRandomSearchQuery,
  pickBestVideo,
  pickRandomTitle,
} from '@/lib/constants';

interface UseAutoRandomParams {
  // Auto-mode is on for the room.
  enabled: boolean;
  // Caller-controlled gate. TV passes `isInitialized`, mobile passes `true`
  // once it's mounted and acting as a player.
  ready: boolean;
  // True while a song is currently in the "now playing" slot. The picker
  // only fires when the slot is empty — we never pre-fetch into the queue
  // because the queue is reserved for user picks.
  hasCurrentPlaying: boolean;
  queueLength: number;
  randomFilters: RandomFilters;
  playedHistory: string[];
  // Writes the picked video straight to currentPlaying (bypassing the queue).
  setCurrentPlayingDirectly: (item: YouTubeVideo) => Promise<void>;
  addToPlayedHistory: (id: string) => Promise<void>;
}

// Drives the "nothing playing + queue empty + auto on → fetch a song and
// play it" loop. Used by both TV and Mobile clients so the room never goes
// silent even when the TV isn't running. The internal busy ref prevents
// intra-client double-fires; cross-client races are rare in practice — the
// song lands in currentPlaying within milliseconds and the second client's
// effect re-runs and bails on `hasCurrentPlaying`.
export function useAutoRandom({
  enabled,
  ready,
  hasCurrentPlaying,
  queueLength,
  randomFilters,
  playedHistory,
  setCurrentPlayingDirectly,
  addToPlayedHistory,
}: UseAutoRandomParams) {
  const busyRef = useRef(false);

  const tryAutoRandom = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const triedTitles = new Set<string>();
      const playedIds = new Set(playedHistory);
      // Up to 5 title attempts before giving up — bounded so we don't loop
      // forever if the API misbehaves or the pool is exhausted.
      for (let attempt = 0; attempt < 5; attempt++) {
        const title = pickRandomTitle(triedTitles, randomFilters.genre);
        triedTitles.add(title);
        const query = buildRandomSearchQuery(title, randomFilters);
        const { videos } = await searchYouTube(query);
        const fresh = pickBestVideo(videos, randomFilters, playedIds);
        if (fresh) {
          await setCurrentPlayingDirectly(fresh);
          await addToPlayedHistory(fresh.id);
          return;
        }
      }
    } finally {
      busyRef.current = false;
    }
  }, [
    playedHistory,
    randomFilters,
    setCurrentPlayingDirectly,
    addToPlayedHistory,
  ]);

  useEffect(() => {
    if (!ready) return;
    if (!enabled) return;
    // Hold off when something is already playing — auto-random is the
    // fallback when the room has nothing to play, not a queue-filler.
    if (hasCurrentPlaying) return;
    // Hold off when the user has queued songs — those take precedence and
    // get auto-promoted by the parent's existing currentPlaying-empty
    // effect. Once the user-queued songs run out, the slot empties again
    // and this effect re-fires.
    if (queueLength > 0) return;
    tryAutoRandom();
  }, [ready, enabled, hasCurrentPlaying, queueLength, tryAutoRandom]);

  return tryAutoRandom;
}
