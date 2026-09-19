import { NextRequest, NextResponse } from 'next/server';
import { normalizeQuery, QuotaExhaustedError, searchYouTubeApi } from '@/lib/youtube/server';
export { __resetKeyCursorForTests } from '@/lib/youtube/server';

export async function GET(req: NextRequest) {
  const normalized = normalizeQuery(req.nextUrl.searchParams.get('q') ?? '');
  if (!normalized) return NextResponse.json({ error: 'missing_query' }, { status: 400 });
  try {
    return NextResponse.json(await searchYouTubeApi(normalized));
  } catch (err) {
    if (err instanceof QuotaExhaustedError) return NextResponse.json({ error: 'quota_exhausted' }, { status: 429 });
    console.error('[youtube-bff] search failed:', err);
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
