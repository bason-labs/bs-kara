import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { parseVideoId } from '@bs-kara/shared';

// The slice of react-native-youtube-iframe's ref we depend on. Its methods are
// async (Promise-based), unlike the web YouTube player.
export interface AdMaskNativeRef {
  getVideoUrl: () => Promise<string>;
}

const POLL_MS = 250;
const DEBOUNCE_POLLS = 2; // signal must hold ~500ms before the gate flips
const SAFETY_CAP_MS = 45_000;

// Async ad probe. Fail-safe: not playing, no requested id, no ref, unparseable
// url, or any rejection → false (never a false ad).
export async function detectAdNative(
  ref: AdMaskNativeRef | null,
  requestedVideoId: string,
  isPlaying: boolean,
): Promise<boolean> {
  if (!ref || !requestedVideoId || !isPlaying) return false;
  try {
    const url = await ref.getVideoUrl();
    const id = parseVideoId(url);
    if (!id) return false; // SPIKE NOTE: flip to `return true` if ads report an
    // empty url rather than a different id (see web Phase-0 spike).
    return id !== requestedVideoId;
  } catch {
    return false;
  }
}

// Polls detectAdNative on an interval and exposes a debounced, self-clearing ad
// gate. Disarms whenever there is nothing to measure (no song id / not playing).
export function useAdMask(
  playerRef: RefObject<AdMaskNativeRef | null>,
  requestedVideoId: string,
  isPlaying: boolean,
): { isAdGated: boolean } {
  const [isAdGated, setIsAdGated] = useState(false);
  const gatedRef = useRef(false);
  const streakRef = useRef(0);

  useEffect(() => {
    gatedRef.current = isAdGated;
  }, [isAdGated]);

  useEffect(() => {
    if (!requestedVideoId || !isPlaying) {
      setIsAdGated(false);
      streakRef.current = 0;
      return;
    }
    // Poll SEQUENTIALLY: reschedule only after each awaited probe resolves, so
    // a slow getVideoUrl() bridge call can never overlap the next one and let
    // stale out-of-order results flip the gate late.
    let cancelled = false;
    let id: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      const adNow = await detectAdNative(playerRef.current, requestedVideoId, isPlaying);
      if (cancelled) return;
      if (adNow === gatedRef.current) {
        streakRef.current = 0;
      } else {
        streakRef.current += 1;
        if (streakRef.current >= DEBOUNCE_POLLS) {
          streakRef.current = 0;
          setIsAdGated(adNow);
        }
      }
      id = setTimeout(poll, POLL_MS);
    };
    id = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      if (id) clearTimeout(id);
    };
  }, [playerRef, requestedVideoId, isPlaying]);

  // Safety cap: a stuck reading can never freeze the room behind a muted/covered
  // player. NOTE: if a real ad signal outlasts the cap, force-clearing briefly
  // unmutes (~one poll) until the gate re-arms — accepted tradeoff.
  useEffect(() => {
    if (!isAdGated) return;
    const id = setTimeout(() => setIsAdGated(false), SAFETY_CAP_MS);
    return () => clearTimeout(id);
  }, [isAdGated]);

  return { isAdGated };
}
