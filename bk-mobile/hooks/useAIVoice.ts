import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

export const DEFAULT_MC_VOICE = 'vi-VN-Neural2-A';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

// expo-speech fallback used when /api/tts (Google Cloud TTS) is unavailable
// — quota exhausted, 4xx/5xx, network failure, or audio playback error.
// Mirrors the word-count safety timeout from the web version so the gate
// never gets stuck if onDone never fires (e.g. Android silent drop).
function speakWithNativeTTS(text: string): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve();
    };

    // Safety: some platforms drop the onDone/onError callbacks silently.
    // Resolve based on a generous worst-case duration sized by text length
    // so the gate doesn't get stuck forever. ~600ms per word covers slow
    // Vietnamese TTS with margin.
    const wordCount = Math.max(1, text.trim().split(/\s+/).length);
    timer = setTimeout(finish, Math.max(5000, wordCount * 600));

    try {
      Speech.speak(text, {
        language: 'vi-VN',
        onDone: finish,
        onError: () => finish(),
        onStopped: () => finish(),
      });
    } catch {
      finish();
    }
  });
}

export interface UseAIVoiceResult {
  speak: (text: string, voiceName?: string) => Promise<void>;
  cancel: () => void;
  previewVoice: (voiceName: string, sampleText: string) => Promise<void>;
  voicesReady: boolean;
}

export function useAIVoice(): UseAIVoiceResult {
  // Ref to the current expo-av Sound instance for Google TTS playback.
  // cancel() stops and unloads it, equivalent to audio.pause() +
  // removeAttribute('src') + audio.load() in the web version.
  const currentSoundRef = useRef<Audio.Sound | null>(null);
  // Tracks the in-flight /api/tts fetch from the most recent previewVoice
  // call so a rapid second click can abort the first before its audio lands.
  const previewAbortRef = useRef<AbortController | null>(null);
  // Google Cloud TTS is the default path and doesn't need voice warmup.
  // voicesReady is kept in state for API parity with the web hook.
  const [voicesReady] = useState(true);

  const cancel = useCallback(() => {
    // Stop native TTS unconditionally — a fallback may have hopped from
    // Google → expo-speech mid-announcement, so cancelling only one engine
    // would leave a stale utterance running.
    try {
      void Speech.stop();
    } catch {
      // ignore
    }

    const sound = currentSoundRef.current;
    if (sound) {
      currentSoundRef.current = null;
      // Fire-and-forget: stop and release the audio buffer.
      sound.stopAsync().catch(() => {});
      sound.unloadAsync().catch(() => {});
    }
  }, []);

  // Plays a Google-TTS audioContent payload (base64 mp3). Resolves when
  // playback ends, rejects on failure so the caller can fall back to
  // expo-speech. Uses a data URI accepted by expo-av's createAsync.
  const playGoogleAudio = useCallback(
    (audioContent: string, text: string): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        (async () => {
          try {
            // Stop any prior sound before creating the new one so we
            // never have two concurrent playbacks.
            const prior = currentSoundRef.current;
            if (prior) {
              currentSoundRef.current = null;
              prior.stopAsync().catch(() => {});
              prior.unloadAsync().catch(() => {});
            }

            const { sound } = await Audio.Sound.createAsync(
              { uri: `data:audio/mpeg;base64,${audioContent}` },
              { shouldPlay: false },
            );
            currentSoundRef.current = sound;

            let settled = false;
            let safetyTimer: ReturnType<typeof setTimeout> | null = null;

            const cleanupSound = () => {
              if (safetyTimer) clearTimeout(safetyTimer);
              if (currentSoundRef.current === sound) {
                currentSoundRef.current = null;
              }
            };

            const finish = () => {
              if (settled) return;
              settled = true;
              cleanupSound();
              resolve();
            };

            const fail = (err: Error) => {
              if (settled) return;
              settled = true;
              cleanupSound();
              reject(err);
            };

            sound.setOnPlaybackStatusUpdate((status) => {
              if (!status.isLoaded) return;
              if (status.didJustFinish) {
                finish();
              }
            });

            // Safety net: the playback-status 'didJustFinish' event can drop
            // silently (e.g. data-URI on some Android versions). Resolve on a
            // generous worst-case duration sized by text length — ~600ms per
            // word covers slow Vietnamese TTS with margin.
            const wordCount = Math.max(1, text.trim().split(/\s+/).length);
            const safetyMs = Math.max(6000, wordCount * 600 + 2000);
            safetyTimer = setTimeout(finish, safetyMs);

            try {
              await sound.playAsync();
            } catch (err) {
              // If playAsync throws (e.g. the sound was unloaded by cancel()
              // between createAsync and playAsync), treat as a silent cancel
              // so we don't double-speak into the expo-speech fallback.
              if (err instanceof Error && err.message?.includes('unload')) {
                if (!settled) { settled = true; cleanupSound(); resolve(); }
              } else {
                fail(err instanceof Error ? err : new Error(String(err)));
              }
            }
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        })();
      }),
    [],
  );

  // Always tries Google Cloud TTS first via /api/tts; on ANY failure
  // (HTTP non-2xx, empty body, network error, audio playback error)
  // auto-falls back to expo-speech. No env-var gating.
  const speak = useCallback(
    async (text: string, voiceName?: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed) return;

      try {
        const res = await fetch(`${API_BASE}/api/tts`, {
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
        // If cancel() stopped playback mid-flight the Sound's stopAsync
        // propagates an error. In that case the interruption is intentional
        // — don't fall back to expo-speech (that would double-speak).
        // We detect it by checking whether the sound ref was already cleared.
        if (currentSoundRef.current === null && error instanceof Error) {
          // sound was intentionally cancelled — no fallback
          return;
        }
        console.warn(
          '[useAIVoice] Auto-falling back to native TTS due to error:',
          error,
        );
        await speakWithNativeTTS(trimmed);
      }
    },
    [playGoogleAudio],
  );

  // Plays a short sample of `sampleText` rendered with the requested voice.
  // Built for the settings voice picker: spamming voices must not stack —
  // each call cancels the prior preview's audio and aborts its in-flight
  // fetch so only the latest selection is heard. Falls back to expo-speech
  // on Google failure, same as speak().
  const previewVoice = useCallback(
    async (voiceName: string, sampleText: string): Promise<void> => {
      const trimmed = sampleText.trim();
      if (!trimmed) return;

      cancel();
      previewAbortRef.current?.abort();
      const ac = new AbortController();
      previewAbortRef.current = ac;

      try {
        const res = await fetch(`${API_BASE}/api/tts`, {
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
        if (error instanceof Error && error.name === 'AbortError') return;
        try {
          await speakWithNativeTTS(trimmed);
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

// No-op stub for API parity with bk-web call sites.
// React Native / expo-av does not require an audio unlock gesture in the
// same way browsers do — Audio.Sound.createAsync works without a prior
// user gesture on both iOS and Android.
export function primeAudio(): void {
  // intentional no-op
}
