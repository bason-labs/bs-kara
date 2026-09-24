import 'server-only';
import { unstable_cache } from 'next/cache';

const GOOGLE_TTS_ENDPOINT =
  'https://texttospeech.googleapis.com/v1/text:synthesize';
const TIMEOUT_MS = 4000;
const CACHE_REVALIDATE_SECONDS = 86400;
export const DEFAULT_VOICE = 'vi-VN-Neural2-A';
// Whitelist matches the Settings UI dropdown — anything else gets rejected
// so a malformed/spoofed body can't make Google synthesize an unexpected
// voice (or one outside the languageCode we hardcode below).
export const ALLOWED_VOICES = new Set([
  'vi-VN-Neural2-A',
  'vi-VN-Wavenet-C',
  'vi-VN-Neural2-D',
  'vi-VN-Wavenet-B',
]);

// Carries the response status + error code through the cache wrapper so
// the route handler can map upstream failures to the same shape the
// pre-cache implementation used. Errors thrown from inside `unstable_cache`
// bypass storage, so transient 4xx/5xx responses don't poison the cache.
export class TTSError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(`TTS upstream error (${status} ${code})`);
    this.status = status;
    this.code = code;
  }
}

async function synthesize(text: string, voiceName: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  // Callers check isTTSConfigured() first, so this is just a belt-and-suspenders
  // guard to satisfy the type checker / future callers.
  if (!apiKey) throw new TTSError(503, 'tts_not_configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `${GOOGLE_TTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'vi-VN', name: voiceName },
          audioConfig: { audioEncoding: 'MP3' },
        }),
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      console.error('[tts] Google TTS returned', res.status);
      // Mirror Google's status (within the 4xx/5xx range) so the client can
      // distinguish quota exhaustion (429) from auth/config errors (401/403)
      // and fall back to browser TTS in every non-2xx case.
      const status = res.status >= 400 && res.status < 600 ? res.status : 502;
      throw new TTSError(status, 'google_tts_failed');
    }

    const data = (await res.json()) as { audioContent?: unknown };
    const audioContent =
      typeof data.audioContent === 'string' ? data.audioContent : null;
    if (!audioContent) throw new TTSError(502, 'empty_audio');
    return audioContent;
  } finally {
    clearTimeout(timer);
  }
}

export const cachedSynthesize = unstable_cache(
  synthesize,
  ['tts-synthesize'],
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: ['tts'] },
);

/** Google Cloud TTS needs GOOGLE_TTS_API_KEY; without it callers fall back to browser TTS. */
export function isTTSConfigured(): boolean {
  return Boolean(process.env.GOOGLE_TTS_API_KEY);
}

/** A voice from the allow-list, or the default for anything else. */
export function resolveVoice(requested: unknown): string {
  const name = typeof requested === 'string' ? requested : '';
  return ALLOWED_VOICES.has(name) ? name : DEFAULT_VOICE;
}
