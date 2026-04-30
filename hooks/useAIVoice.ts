'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// NEXT_PUBLIC_ is mandatory here: the choice is read on the client. The API
// keys themselves still live server-side and are only ever touched by the
// /api/tts route. Default to "browser" so missing env doesn't break dev.
const TTS_PROVIDER = (
  process.env.NEXT_PUBLIC_TTS_PROVIDER ?? 'browser'
).toLowerCase();

// Web-Speech path with Vietnamese voice picking.
function speakViaBrowser(text: string): Promise<void> {
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
  // Voice list readiness only matters for the browser backend. Surfaced
  // for parity with the previous API.
  const [voicesReady, setVoicesReady] = useState(TTS_PROVIDER !== 'browser');

  useEffect(() => {
    if (TTS_PROVIDER !== 'browser') return;
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
    if (TTS_PROVIDER === 'browser') {
      window.speechSynthesis?.cancel();
      return;
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

  const speak = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (typeof window === 'undefined') return;

      if (TTS_PROVIDER === 'google') {
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: trimmed }),
          });
          if (res.ok) {
            const data = (await res.json()) as { audioContent?: string | null };
            if (data.audioContent) {
              await new Promise<void>((resolve) => {
                // Stop any prior playback (cancel() already nulls handlers).
                cancel();
                const audio = new Audio(
                  `data:audio/mpeg;base64,${data.audioContent}`,
                );
                currentAudioRef.current = audio;
                let settled = false;
                const finish = () => {
                  if (settled) return;
                  settled = true;
                  if (currentAudioRef.current === audio) {
                    currentAudioRef.current = null;
                  }
                  resolve();
                };
                audio.onended = finish;
                audio.onerror = finish;
                audio.play().catch(finish);
              });
              return;
            }
          }
        } catch {
          // Fall through to browser TTS as a graceful fallback.
        }
        // If Google TTS failed (no key, network, or empty audioContent),
        // try the browser engine instead so the user still hears the line.
        await speakViaBrowser(trimmed);
        return;
      }

      // Default browser path
      await speakViaBrowser(trimmed);
    },
    [cancel],
  );

  return { speak, cancel, voicesReady };
}

// Synchronous unlock used inside a click/tap handler. Browsers (notably
// iOS Safari and mobile Chrome) gate speechSynthesis and Audio playback
// behind a recent user gesture; calling speak() from inside an async
// useEffect can fall outside that window. Calling primeAudio() inline
// in the click handler that mounts the player keeps the gesture context
// alive for the announcement that follows.
export function primeAudio(): void {
  if (typeof window === 'undefined') return;
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
  if (TTS_PROVIDER !== 'browser') {
    try {
      // Tiny silent MP3 — enough for the audio engine to unlock
      // subsequent Audio.play() calls. Failure is fine; this is a hint.
      const silent = new Audio(
        'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwP/////////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAUHQQAAgAAAAEhDmHwzAAAAAAAAAAAAAAAAAAAA',
      );
      silent.volume = 0;
      silent.play().catch(() => {});
    } catch {
      // ignore
    }
  }
}
