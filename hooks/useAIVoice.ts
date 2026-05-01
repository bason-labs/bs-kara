'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export const DEFAULT_MC_VOICE = 'vi-VN-Neural2-A';

// Web-Speech path with Vietnamese voice picking. Used as the auto-fallback
// when /api/tts (Google Cloud TTS) is unavailable — quota exhausted, 4xx/5xx,
// network failure, or audio playback error.
function speakWithBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();
    const synth = window.speechSynthesis;
    if (!synth) return resolve();

    const utter = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const vi = voices.find((v) => v.lang?.toLowerCase().includes('vi'));
    if (vi) {
      utter.voice = vi;
      utter.lang = vi.lang;
    } else {
      utter.lang = 'vi-VN';
    }
    utter.rate = 1;
    utter.pitch = 1;

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve();
    };
    utter.onend = finish;
    utter.onerror = finish;

    // Chrome auto-pauses the synthesis engine after periods of inactivity
    // or when the page goes background. resume() is a no-op when nothing
    // is queued; safe to call defensively.
    if (synth.paused) synth.resume();

    // Don't cancel before speak: cancelling the priming utterance left by
    // primeAudio() (or a previous speak's tail) puts some engines into a
    // state where the next speak() resolves immediately without producing
    // audio. The hook's cancel() handles cross-song interruption.
    synth.speak(utter);

    // Safety: some browsers (notably mobile Chrome and iOS Safari) drop
    // utterances silently — onend never fires. Resolve based on a generous
    // worst-case duration so the gate doesn't get stuck forever. ~600ms
    // per word covers slow speech with margin.
    const wordCount = Math.max(1, text.trim().split(/\s+/).length);
    timer = setTimeout(finish, Math.max(5000, wordCount * 600));
  });
}

export function useAIVoice() {
  // Keep a single Audio element ref so cancel() can stop a Google-TTS
  // playback mid-flight (browser TTS uses speechSynthesis.cancel directly).
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  // Tracks the in-flight /api/tts fetch from the most recent previewVoice
  // call so a rapid second click can abort the first before its audio lands.
  const previewAbortRef = useRef<AbortController | null>(null);
  // Google is the default path and doesn't need voice list warmup. We still
  // warm browser voices in the background for the fallback case.
  const [voicesReady, setVoicesReady] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    function pickVoice() {
      const voices = synth.getVoices();
      if (!voices || voices.length === 0) return;
      setVoicesReady(true);
    }
    pickVoice();
    synth.addEventListener?.('voiceschanged', pickVoice);
    return () => {
      synth.removeEventListener?.('voiceschanged', pickVoice);
    };
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === 'undefined') return;
    // Cancel both engines unconditionally: a fallback may have hopped from
    // Google → browser mid-announcement, so cancelling only one engine
    // would leave a stale utterance running.
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
    const audio = currentAudioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      // Detach the source so the browser releases the buffer immediately.
      audio.removeAttribute('src');
      audio.load();
      currentAudioRef.current = null;
    }
  }, []);

  // Plays a Google-TTS audioContent payload. Resolves when playback ends,
  // rejects on playback failure so the caller can fall back to browser TTS.
  const playGoogleAudio = useCallback(
    (audioContent: string, text: string): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        try {
          const prior = currentAudioRef.current;
          if (prior) {
            prior.onended = null;
            prior.onerror = null;
            prior.pause();
            prior.removeAttribute('src');
            prior.load();
          }
          const audio = new Audio(`data:audio/mpeg;base64,${audioContent}`);
          currentAudioRef.current = audio;
          let settled = false;
          let safetyTimer: ReturnType<typeof setTimeout> | null = null;
          const cleanupAudio = () => {
            if (safetyTimer) clearTimeout(safetyTimer);
            if (currentAudioRef.current === audio) {
              currentAudioRef.current = null;
            }
          };
          const finish = () => {
            if (settled) return;
            settled = true;
            cleanupAudio();
            resolve();
          };
          audio.onended = finish;
          audio.onerror = () => {
            if (settled) return;
            settled = true;
            cleanupAudio();
            reject(new Error('audio_playback_error'));
          };
          audio.play().catch((err) => {
            if (settled) return;
            settled = true;
            cleanupAudio();
            reject(err instanceof Error ? err : new Error(String(err)));
          });
          // Safety net: in fullscreen mode (and occasionally on iOS) the
          // `ended` event from a data-URI Audio element can drop silently,
          // leaving the MC gate stuck and the song never starting. Resolve
          // on a generous worst-case duration sized by text length so the
          // gate releases even if `onended` never fires. Roughly ~600ms
          // per word covers slow Vietnamese TTS with margin.
          const wordCount = Math.max(1, text.trim().split(/\s+/).length);
          const safetyMs = Math.max(6000, wordCount * 600 + 2000);
          safetyTimer = setTimeout(finish, safetyMs);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      }),
    [],
  );

  // Always tries Google Cloud TTS first via /api/tts; on ANY failure (HTTP
  // non-2xx, empty body, network error, audio playback error) auto-falls
  // back to native window.speechSynthesis. No env-var gating.
  const speak = useCallback(
    async (text: string, voiceName?: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (typeof window === 'undefined') return;

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: trimmed,
            voiceName: voiceName || DEFAULT_MC_VOICE,
          }),
        });
        if (!res.ok) {
          throw new Error(`Google TTS Failed (HTTP ${res.status})`);
        }
        const data = (await res.json()) as { audioContent?: string | null };
        if (!data.audioContent) {
          throw new Error('Google TTS Failed (empty audio)');
        }
        await playGoogleAudio(data.audioContent, trimmed);
      } catch (error) {
        console.warn(
          '[useAIVoice] Auto-falling back to browser TTS due to error:',
          error,
        );
        await speakWithBrowser(trimmed);
      }
    },
    [playGoogleAudio],
  );

  // Plays a short sample of `sampleText` rendered with the requested voice.
  // Built for the settings voice picker: spamming voices must not stack —
  // each call cancels the prior preview's audio and aborts its in-flight
  // fetch so only the latest selection is heard. Falls back to browser TTS
  // on Google failure, same as speak().
  const previewVoice = useCallback(
    async (voiceName: string, sampleText: string): Promise<void> => {
      const trimmed = sampleText.trim();
      if (!trimmed) return;
      if (typeof window === 'undefined') return;

      cancel();
      previewAbortRef.current?.abort();
      const ac = new AbortController();
      previewAbortRef.current = ac;

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed, voiceName }),
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        if (!res.ok) throw new Error(`Google TTS Failed (HTTP ${res.status})`);
        const data = (await res.json()) as { audioContent?: string | null };
        if (ac.signal.aborted) return;
        if (!data.audioContent) throw new Error('Google TTS Failed (empty audio)');
        await playGoogleAudio(data.audioContent, trimmed);
      } catch (error) {
        if (ac.signal.aborted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        try {
          await speakWithBrowser(trimmed);
        } catch {
          // Preview failures are non-critical — surface as a warning only.
          console.warn('[useAIVoice] Voice preview fallback failed:', error);
        }
      }
    },
    [cancel, playGoogleAudio],
  );

  return { speak, cancel, previewVoice, voicesReady };
}

// Synchronous unlock used inside a click/tap handler. Browsers (notably
// iOS Safari and mobile Chrome) gate speechSynthesis and Audio playback
// behind a recent user gesture; calling speak() from inside an async
// useEffect can fall outside that window. Calling primeAudio() inline
// in the click handler that mounts the player keeps the gesture context
// alive for the announcement that follows.
export function primeAudio(): void {
  if (typeof window === 'undefined') return;
  // Prime both engines unconditionally: Google is the default path, but
  // we may auto-fall-back to speechSynthesis on quota/network errors, and
  // the unlock has to happen inside the original gesture.
  try {
    const synth = window.speechSynthesis;
    if (synth) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      synth.speak(u);
    }
  } catch {
    // Some browsers throw on empty utterances; ignore.
  }
  try {
    // Tiny silent MP3 — enough for the audio engine to unlock subsequent
    // Audio.play() calls used by the Google TTS path. Failure is fine;
    // this is a hint.
    const silent = new Audio(
      'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwP/////////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAUHQQAAgAAAAEhDmHwzAAAAAAAAAAAAAAAAAAAA',
    );
    silent.volume = 0;
    silent.play().catch(() => {});
  } catch {
    // ignore
  }
}
