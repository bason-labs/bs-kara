import { useEffect, useRef, useState } from 'react';
import type { YouTubeVideo } from '@bs-kara/shared';
import { useAIVoice } from './useAIVoice';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

interface UseMCPlayerArgs {
  // Master switch: when false, the hook never gates and never speaks.
  // Wired to roomData.isMCEnabled at the call site.
  isMCEnabled: boolean;
  // The song currently meant to play. The hook fires on transitions of
  // currentPlaying.id — skipping nothing on first observation so the
  // cross-device lock (tryClaimAnnouncementLock) correctly suppresses
  // re-announcements on reconnect.
  currentPlaying: YouTubeVideo | null;
  // Caller-provided gate (e.g. FullscreenPlayer can pass true since
  // opening it IS a gesture). Must be true for the hook to speak.
  ready: boolean;
  // Google TTS voice id chosen by the host (Settings). Falls back
  // to the default when undefined/empty so older rooms keep working.
  mcVoice?: string;
  // Cross-device lock: returns true if this caller won the race to be
  // the announcer for `songId`. False means another device beat us — we
  // skip MC and let the video play immediately. Optional so the hook
  // also works when no lock is plumbed (single-device scenario).
  tryClaimAnnouncementLock?: (songId: string) => Promise<boolean>;
}

interface UseMCPlayerResult {
  // True while the MC is preparing/speaking for the current song. The
  // caller should NOT mount the YouTube iframe while this is true,
  // otherwise autoplay will play the song over the announcement.
  isMcGated: boolean;
  // The MC line currently being announced — useful for showing the text
  // on screen alongside the speech.
  mcText: string | null;
}

// Live AI fetch used when the pre-generated mcText hasn't landed by the
// time the song reaches the top (e.g. auto-random skipped pre-generation,
// the LLM is still in flight past our poll budget, or the song was added
// before MC was enabled). We refuse to fall back to a static template —
// returning null tells the caller to skip the announcement entirely so we
// never read the raw SEO-noisy YouTube title to the room.
//
// RN adaptations vs web:
//   - AbortSignal.any() is not available in Hermes/JSC; replaced with a
//     manual Promise.race() and a cancelled flag.
//   - AbortSignal.timeout(6000) is not available in Hermes; replaced with
//     a manual setTimeout-based AbortController signal.
//   - Absolute URL via EXPO_PUBLIC_API_BASE_URL since RN has no implicit base.
async function fetchLiveMcText(
  title: string,
  singer: string | null,
  cancelled: () => boolean,
): Promise<string | null> {
  // Build a manual timeout signal since AbortSignal.timeout() is not
  // available in Hermes / JSC.
  const timeoutAc = new AbortController();
  const timeoutHandle = setTimeout(() => timeoutAc.abort(), 6000);

  try {
    // Race the fetch against the timeout. If the outer effect has already
    // set cancelled=true (song changed), bail before even starting.
    if (cancelled()) return null;

    const res = await fetch(`${API_BASE}/api/generate-mc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songTitle: title, singerName: singer }),
      signal: timeoutAc.signal,
    });
    if (cancelled()) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: unknown };
    if (cancelled()) return null;
    return typeof data.text === 'string' && data.text.trim()
      ? data.text.trim()
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export function useMCPlayer({
  isMCEnabled,
  currentPlaying,
  ready,
  mcVoice,
  tryClaimAnnouncementLock,
}: UseMCPlayerArgs): UseMCPlayerResult {
  const { speak, cancel: cancelSpeech } = useAIVoice();

  // Mirror the voice choice in a ref so the announcer effect doesn't have
  // to depend on it — switching voices mid-announcement would otherwise
  // cancel the in-flight speech and re-fetch the line.
  const mcVoiceRef = useRef(mcVoice);
  mcVoiceRef.current = mcVoice;

  // Lazy init: if MC is set up to fire on this mount, gate synchronously
  // from the first render so the YT embed never starts loading before the
  // announcement. (React Native doesn't have DOM paint but the same
  // race can occur if the effect runs on the next tick while the component
  // tree is still reconciling.)
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
  // effect cleanup (refs persist) so a React strict-mode double-invoke
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

  // useEffect instead of useLayoutEffect — React Native has no DOM paint
  // cycle so useLayoutEffect provides no benefit and triggers a warning.
  useEffect(() => {
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
    // Per-effect controller bound to the live MC fetch signal. Cleanup
    // aborts it so a fast song change cancels the in-flight upstream call
    // instead of letting it run to completion (or wait out the 6s timeout).
    const liveFetchController = new AbortController();
    setMcGateForId(songId);
    setMcText(null);

    (async () => {
      const claim = tryClaimRef.current;
      let won: boolean;
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

      // The LLM call is fired at add-time but typically takes 1–3s. When a
      // song is added to an empty queue with nothing playing, it gets
      // promoted to currentPlaying within ~50ms — well before the API
      // responds — so a naive read here would always miss. Poll the ref
      // (Firebase keeps it fresh via onValue) for up to MAX_WAIT_MS before
      // falling back, so the first-song case still gets the AI line
      // instead of the static template.
      const MAX_WAIT_MS = 4000;
      const POLL_INTERVAL_MS = 150;
      const startedAt = Date.now();
      let pre: string | null = null;
      while (true) {
        const cp = currentPlayingRef.current;
        if (!cp || cp.id !== songId) break; // song changed → bail
        const t = cp.mcText?.trim();
        if (t) {
          pre = t;
          break;
        }
        if (Date.now() - startedAt >= MAX_WAIT_MS) break;
        await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (cancelled) return;
      }

      const cp = currentPlayingRef.current;
      let text = pre;
      if (!text && cp && cp.id === songId) {
        // No pre-generated line landed in time — call the AI live with the
        // song's singer so we still get a unique, personalized intro
        // instead of skipping straight to a static template.
        const live = await fetchLiveMcText(
          cp.title,
          cp.requesterName?.trim() || null,
          () => cancelled || liveFetchController.signal.aborted,
        );
        if (cancelled) return;
        text = live;
      }

      if (!text) {
        // AI unavailable — release the gate and let the song play. We do
        // NOT fall back to a static "Tiếp theo chương trình..." template;
        // the user prefers no MC over a canned one.
        setMcGateForId((prev) => (prev === songId ? null : prev));
        setMcText(null);
        return;
      }

      setMcText(text);
      await speak(text, mcVoiceRef.current);
      if (cancelled) return;

      // Only release the gate if it's still the song we were announcing —
      // a fast skip could have moved on already.
      setMcGateForId((prev) => (prev === songId ? null : prev));
      setMcText(null);
    })();

    return () => {
      cancelled = true;
      liveFetchController.abort();
      cancelSpeech();
      // If the effect was cancelled before it could clear the gate (e.g.
      // a song change interrupting an in-flight announcement), reset both
      // the gate and lastHandledId. The new song's run will set them
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
