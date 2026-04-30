'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { YouTubeVideo } from '@/lib/youtube';
import { useAIVoice } from './useAIVoice';

interface UseMCPlayerArgs {
  // Master switch: when false, the hook never gates and never speaks.
  // Wired to roomData.isMCEnabled at the call site.
  isMCEnabled: boolean;
  // The song currently meant to play. The hook fires on transitions of
  // currentPlaying.id, never on the first one observed (so opening the
  // player mid-song doesn't speak over the song already in progress).
  currentPlaying: YouTubeVideo | null;
  // Caller-provided gate (e.g. TV waits for the user's first gesture via
  // isInitialized; FullscreenPlayer can pass true since opening it IS a
  // gesture). Speech APIs require a user gesture on most browsers.
  ready: boolean;
  // Cross-device lock: returns true if this caller won the race to be
  // the announcer for `songId`. False means another device beat us — we
  // skip MC and let the video play immediately. Optional so the hook
  // also works when no lock is plumbed (single-device scenario).
  tryClaimAnnouncementLock?: (songId: string) => Promise<boolean>;
}

interface UseMCPlayerResult {
  // True while the MC is preparing/speaking for the current song. The
  // caller should NOT mount the YouTube iframe while this is true,
  // otherwise autoplay=1 will play the song over the announcement.
  isMcGated: boolean;
  // The MC line currently being announced — useful for showing the text
  // on screen alongside the speech.
  mcText: string | null;
}

const FALLBACK_TEXT =
  'Xin mời quý vị cùng thưởng thức ca khúc tiếp theo ngay sau đây!';

export function useMCPlayer({
  isMCEnabled,
  currentPlaying,
  ready,
  tryClaimAnnouncementLock,
}: UseMCPlayerArgs): UseMCPlayerResult {
  const { speak, cancel: cancelSpeech } = useAIVoice();
  // Lazy init: if MC is set up to fire on this mount, gate the iframe
  // synchronously from render 1. Without this, the YT embed has time to
  // start loading (and autoplay audio) during the brief window between
  // first paint and the announcer effect firing.
  const [mcGateForId, setMcGateForId] = useState<string | null>(() =>
    ready && isMCEnabled && currentPlaying ? currentPlaying.id : null,
  );
  const [mcText, setMcText] = useState<string | null>(null);
  // Tracks the song id we've already kicked off (announced, skipped, or
  // lost the race for). The lock in Firebase is the cross-device source
  // of truth — we don't init-skip the first song observation here, since
  // the lock check correctly suppresses re-announcements on reconnect.
  const lastHandledIdRef = useRef<string | null>(null);
  // Songs this hook instance has already won the lock for. Survives
  // effect cleanup (refs persist) so a strict-mode-dev double-run
  // doesn't lose to itself on the second claim attempt.
  const claimedForIdRef = useRef<string | null>(null);
  // Mirror of currentPlaying so the effect (which depends only on the id)
  // can read fresh title / requesterName / mcText without tripping a
  // re-run every time another field of the room state updates.
  const currentPlayingRef = useRef(currentPlaying);
  currentPlayingRef.current = currentPlaying;
  // The lock function changes identity on every roomId change. Keeping it
  // in a ref means we don't have to depend on it (which would cancel
  // in-flight announcements every time roomData re-renders).
  const tryClaimRef = useRef(tryClaimAnnouncementLock);
  tryClaimRef.current = tryClaimAnnouncementLock;

  const songId = currentPlaying?.id ?? null;

  // Layout effect (not useEffect) so the iframe-gating state update runs
  // before the browser paints the new VideoPlayer. With a regular effect,
  // the iframe gets painted, starts loading the YouTube embed, and may
  // begin autoplaying audio in the brief window before the gate flips.
  useLayoutEffect(() => {
    if (!ready) return;

    if (!songId) {
      lastHandledIdRef.current = null;
      setMcGateForId(null);
      setMcText(null);
      cancelSpeech();
      return;
    }

    if (songId === lastHandledIdRef.current) return;
    lastHandledIdRef.current = songId;

    if (!isMCEnabled) {
      setMcGateForId(null);
      setMcText(null);
      return;
    }

    let cancelled = false;
    setMcGateForId(songId);
    setMcText(null);

    (async () => {
      const claim = tryClaimRef.current;
      let won = false;
      if (claimedForIdRef.current === songId) {
        // Strict-mode double-invoke or quick remount: this hook's prior
        // run already claimed the lock; treat the duplicate claim attempt
        // as still-winning instead of losing to ourselves.
        won = true;
      } else if (claim) {
        won = await claim(songId);
        if (cancelled) return;
        if (won) claimedForIdRef.current = songId;
      } else {
        // No lock plumbed (single-device test). Behave as if we won.
        won = true;
      }
      if (!won) {
        // Another device beat us — stay silent and let the video play.
        setMcGateForId((prev) => (prev === songId ? null : prev));
        setMcText(null);
        return;
      }

      // Read fresh currentPlaying — by the time the lock resolves, the
      // pre-generated mcText may have arrived in Firebase.
      const cp = currentPlayingRef.current;
      let text = FALLBACK_TEXT;
      if (cp && cp.id === songId && cp.mcText && cp.mcText.trim()) {
        text = cp.mcText.trim();
      } else if (cp && cp.id === songId) {
        try {
          const res = await fetch('/api/generate-mc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              songTitle: cp.title,
              singerName: cp.requesterName ?? null,
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { text?: unknown };
            if (typeof data.text === 'string' && data.text.trim()) {
              text = data.text.trim();
            }
          }
        } catch {
          // Network failure — fall back to the default line above.
        }
      }
      if (cancelled) return;
      setMcText(text);
      await speak(text);
      if (cancelled) return;
      // Only release the gate if it's still the song we were announcing —
      // a fast skip could have moved on already.
      setMcGateForId((prev) => (prev === songId ? null : prev));
      setMcText(null);
    })();

    return () => {
      cancelled = true;
      cancelSpeech();
      // If the effect was cancelled before it could clear the gate (e.g.
      // a song change interrupting an in-flight announcement), reset both
      // the gate and the lastHandledId. The new song's run will set them
      // again. Without this, a re-run for the same song id would bail on
      // the equality check and leave the gate stuck.
      setMcGateForId((prev) => (prev === songId ? null : prev));
      setMcText(null);
      if (lastHandledIdRef.current === songId) {
        lastHandledIdRef.current = null;
      }
    };
  }, [ready, isMCEnabled, songId, speak, cancelSpeech]);

  const isMcGated = !!songId && mcGateForId === songId;

  return { isMcGated, mcText };
}
