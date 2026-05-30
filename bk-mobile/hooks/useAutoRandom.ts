import { useCallback, useEffect, useRef } from 'react';
import type { RandomFilters, YouTubeVideo } from '@bs-kara/shared';
import {
  buildRandomSearchQuery,
  pickBestVideo,
  pickRandomTitle,
} from '@bs-kara/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

interface UseAutoRandomParams {
  // Auto-mode is on for the room.
  enabled: boolean;
  // Caller-controlled gate. Pass `true` once the component is mounted and
  // acting as a player (mobile always passes true after mount).
  ready: boolean;
  // True while a song is currently in the "now playing" slot. The picker
  // only fires when the slot is empty — auto-random is the fallback when
  // the room has nothing to play, not a queue-filler.
  hasCurrentPlaying: boolean;
  queueLength: number;
  randomFilters: RandomFilters;
  playedHistory: string[];
  // Writes the picked video straight to currentPlaying (bypassing the queue).
  setCurrentPlayingDirectly: (item: YouTubeVideo) => Promise<void>;
  addToPlayedHistory: (id: string) => Promise<void>;
}

// Searches the BFF YouTube endpoint using an absolute URL so the hook works
// in React Native (no window.location origin available).
async function searchYouTube(
  query: string,
): Promise<{ videos: YouTubeVideo[] }> {
  const res = await fetch(
    `${API_BASE}/api/youtube/search?q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) return { videos: [] };
  const data = (await res.json()) as YouTubeVideo[];
  return { videos: Array.isArray(data) ? data : [] };
}

// Drives the "nothing playing + queue empty + auto on → fetch a song and
// play it" loop. Used by the mobile client so the room never goes silent.
// The internal busy ref prevents intra-client double-fires; cross-client
// races are rare in practice — the song lands in currentPlaying within
// milliseconds and the second client's effect re-runs and bails on
// `hasCurrentPlaying`.
export function useAutoRandom({
  enabled,
  ready,
  hasCurrentPlaying,
  queueLength,
  randomFilters,
  playedHistory,
  setCurrentPlayingDirectly,
  addToPlayedHistory,
}: UseAutoRandomParams): () => Promise<void> {
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
    void tryAutoRandom();
  }, [ready, enabled, hasCurrentPlaying, queueLength, tryAutoRandom]);

  return tryAutoRandom;
}
