import { useEffect, useRef, useState } from 'react';

// Minimal player surface useAdMask depends on. The real react-youtube player
// exposes far more; narrowing keeps the unit-test fakes tiny.
export interface AdMaskPlayer {
  getPlayerState: () => number;
  getVideoUrl: () => string;
}

// YT.PlayerState.PLAYING === 1.
const YT_PLAYING = 1;

// Pull the v= id out of a watch URL. Returns null when the URL is empty or has
// no parseable id.
export function parseVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

// True when an ad is *likely* on screen: the player is PLAYING but the id in
// getVideoUrl() differs from the song we asked for. Fail-safe: any throw,
// non-PLAYING state, or unparseable URL returns false (never a false ad).
export function detectAd(player: AdMaskPlayer, requestedVideoId: string): boolean {
  if (!requestedVideoId) return false;
  try {
    if (player.getPlayerState() !== YT_PLAYING) return false;
    const playingId = parseVideoId(player.getVideoUrl());
    if (!playingId) return false; // SPIKE NOTE: if Task 1 found ads report an
    // EMPTY url (not a different id), change this line to `return true`
    // and update the "empty / unparseable url" test to expect true.
    return playingId !== requestedVideoId;
  } catch {
    return false;
  }
}

const POLL_MS = 250;
const DEBOUNCE_POLLS = 2; // signal must hold ~500ms before the gate flips
const SAFETY_CAP_MS = 45_000; // never stay gated longer than this

// Polls detectAd and exposes a debounced, self-clearing ad gate. Mirrors the
// EndScreenOverlay 250ms poll cadence. Returns isAdGated=false whenever there
// is nothing to measure (no player / no song id / not playing) so the overlay
// can never appear spuriously.
export function useAdMask(
  player: AdMaskPlayer | null,
  requestedVideoId: string,
  isPlaying: boolean,
): { isAdGated: boolean } {
  const [isAdGated, setIsAdGated] = useState(false);
  const gatedRef = useRef(false);
  const streakRef = useRef(0); // consecutive polls disagreeing with the gate

  useEffect(() => {
    gatedRef.current = isAdGated;
  }, [isAdGated]);

  useEffect(() => {
    if (!player || !requestedVideoId || !isPlaying) {
      streakRef.current = 0;
      // Wrapping in setTimeout avoids calling setState synchronously in the
      // effect body (react-hooks/set-state-in-effect). Same pattern as
      // useAutoHide.ts.
      const id = window.setTimeout(() => setIsAdGated(false), 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setInterval(() => {
      const adNow = detectAd(player, requestedVideoId);
      if (adNow === gatedRef.current) {
        streakRef.current = 0; // agrees with current gate; nothing to flip
        return;
      }
      streakRef.current += 1;
      if (streakRef.current >= DEBOUNCE_POLLS) {
        streakRef.current = 0;
        setIsAdGated(adNow);
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [player, requestedVideoId, isPlaying]);

  // Safety cap: a stuck reading can never freeze the room behind the overlay.
  // Trade-off: if a genuine ad signal persists past this cap, force-clearing
  // briefly unmutes (≈500ms) until the next debounced poll re-arms the gate.
  // This is an accepted quirk of the safety valve — the alternative (permanent
  // gate on a stale signal) is far worse for the user experience.
  useEffect(() => {
    if (!isAdGated) return;
    const id = window.setTimeout(() => setIsAdGated(false), SAFETY_CAP_MS);
    return () => window.clearTimeout(id);
  }, [isAdGated]);

  return { isAdGated };
}
