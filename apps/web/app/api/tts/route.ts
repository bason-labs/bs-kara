import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

const GOOGLE_TTS_ENDPOINT =
  'https://texttospeech.googleapis.com/v1/text:synthesize';
const TIMEOUT_MS = 4000;
const CACHE_REVALIDATE_SECONDS = 86400;
const DEFAULT_VOICE = 'vi-VN-Neural2-A';
// Whitelist matches the Settings UI dropdown — anything else gets rejected
// so a malformed/spoofed body can't make Google synthesize an unexpected
// voice (or one outside the languageCode we hardcode below).
const ALLOWED_VOICES = new Set([
  'vi-VN-Neural2-A',
  'vi-VN-Wavenet-C',
  'vi-VN-Neural2-D',
  'vi-VN-Wavenet-B',
]);

interface TTSBody {
  text?: unknown;
  voiceName?: unknown;
}

// Carries the response status + error code through the cache wrapper so
// the route handler can map upstream failures to the same shape the
// pre-cache implementation used. Errors thrown from inside `unstable_cache`
// bypass storage, so transient 4xx/5xx responses don't poison the cache.
class TTSError extends Error {
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
  // The route handler validates apiKey before calling, so this is just a
  // belt-and-suspenders guard to satisfy the type checker / future callers.
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

const cachedSynthesize = unstable_cache(
  synthesize,
  ['tts-synthesize'],
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: ['tts'] },
);

export async function POST(req: NextRequest) {
  let body: TTSBody = {};
  try {
    body = (await req.json()) as TTSBody;
  } catch {
    // Malformed JSON — fall through to validation.
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return NextResponse.json({ audioContent: null }, { status: 400 });
  }

  const requestedVoice =
    typeof body.voiceName === 'string' ? body.voiceName : '';
  const voiceName = ALLOWED_VOICES.has(requestedVoice)
    ? requestedVoice
    : DEFAULT_VOICE;

  if (!process.env.GOOGLE_TTS_API_KEY) {
    console.error('[tts] GOOGLE_TTS_API_KEY not configured');
    // 503: service is unavailable on this deployment. Client falls back to
    // browser TTS. Returning 200 with audioContent=null would silently hide
    // the misconfiguration from the client retry path.
    return NextResponse.json(
      { audioContent: null, error: 'tts_not_configured' },
      { status: 503 },
    );
  }

  try {
    const audioContent = await cachedSynthesize(text, voiceName);
    return NextResponse.json({ audioContent });
  } catch (err) {
    if (err instanceof TTSError) {
      return NextResponse.json(
        { audioContent: null, error: err.code },
        { status: err.status },
      );
    }
    console.error('[tts] synthesis failed:', err);
    return NextResponse.json(
      { audioContent: null, error: 'synthesis_error' },
      { status: 502 },
    );
  }
}
