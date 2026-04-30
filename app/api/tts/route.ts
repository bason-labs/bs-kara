import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_TTS_ENDPOINT =
  'https://texttospeech.googleapis.com/v1/text:synthesize';
const TIMEOUT_MS = 4000;

interface TTSBody {
  text?: unknown;
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

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    console.error('[tts] GOOGLE_TTS_API_KEY not configured');
    return NextResponse.json({ audioContent: null });
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
          voice: { languageCode: 'vi-VN', name: 'vi-VN-Neural2-A' },
          audioConfig: { audioEncoding: 'MP3' },
        }),
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      console.error('[tts] Google TTS returned', res.status);
      return NextResponse.json({ audioContent: null });
    }

    const data = (await res.json()) as { audioContent?: unknown };
    const audioContent =
      typeof data.audioContent === 'string' ? data.audioContent : null;
    return NextResponse.json({ audioContent });
  } catch (err) {
    console.error('[tts] synthesis failed:', err);
    return NextResponse.json({ audioContent: null });
  } finally {
    clearTimeout(timer);
  }
}
