import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_TTS_ENDPOINT =
  'https://texttospeech.googleapis.com/v1/text:synthesize';
const TIMEOUT_MS = 4000;
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

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    console.error('[tts] GOOGLE_TTS_API_KEY not configured');
    // 503: service is unavailable on this deployment. Client falls back to
    // browser TTS. Returning 200 with audioContent=null would silently hide
    // the misconfiguration from the client retry path.
    return NextResponse.json(
      { audioContent: null, error: 'tts_not_configured' },
      { status: 503 },
    );
  }

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
      return NextResponse.json(
        { audioContent: null, error: 'google_tts_failed' },
        { status },
      );
    }

    const data = (await res.json()) as { audioContent?: unknown };
    const audioContent =
      typeof data.audioContent === 'string' ? data.audioContent : null;
    if (!audioContent) {
      return NextResponse.json(
        { audioContent: null, error: 'empty_audio' },
        { status: 502 },
      );
    }
    return NextResponse.json({ audioContent });
  } catch (err) {
    console.error('[tts] synthesis failed:', err);
    return NextResponse.json(
      { audioContent: null, error: 'synthesis_error' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
