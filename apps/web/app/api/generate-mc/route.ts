import { NextRequest, NextResponse } from 'next/server';
import { generateMC, type MCVars } from '@/server/mc/generate';
import { nullIfBlank } from '@/server/mc/fallback';

interface GenerateMCBody {
  songTitle?: unknown;
  // Legacy alias for performerName — older callers (hooks/useRoom/mc.ts,
  // hooks/useMCPlayer.ts) still send this. New callers should send
  // performerName.
  singerName?: unknown;
  performerName?: unknown;
  originalArtist?: unknown;
  composer?: unknown;
  genre?: unknown;
  mood?: unknown;
  context?: unknown;
  recentStyles?: unknown;
}

export async function POST(req: NextRequest) {
  let body: GenerateMCBody = {};
  try {
    body = (await req.json()) as GenerateMCBody;
  } catch {
    // Malformed JSON — fall through to validation below.
  }

  const songTitle =
    typeof body.songTitle === 'string' ? body.songTitle.trim() : '';

  if (!songTitle) {
    return NextResponse.json({ text: null }, { status: 400 });
  }

  // performerName takes precedence over the legacy `singerName` alias so
  // newer callers can opt into the renamed field without breaking older
  // ones still sending singerName.
  const performerName =
    nullIfBlank(body.performerName) ?? nullIfBlank(body.singerName);

  const recentStyles = Array.isArray(body.recentStyles)
    ? body.recentStyles
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

  const vars: MCVars = {
    songTitle,
    originalArtist: nullIfBlank(body.originalArtist),
    performerName,
    composer: nullIfBlank(body.composer),
    genre: nullIfBlank(body.genre),
    mood: nullIfBlank(body.mood),
    context: nullIfBlank(body.context),
    recentStyles,
  };

  // The user must NEVER see a hard failure in the karaoke UI: generateMC
  // always resolves, falling back to a template line on any provider error.
  const { text, source } = await generateMC(vars);
  return NextResponse.json({ text }, { headers: { 'X-MC-Source': source } });
}
