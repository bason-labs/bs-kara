import { NextRequest, NextResponse } from 'next/server';
import { cachedSynthesize, isTTSConfigured, resolveVoice, TTSError } from '@/server/tts';

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

  const voiceName = resolveVoice(body.voiceName);

  if (!isTTSConfigured()) {
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
