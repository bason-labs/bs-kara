import { NextRequest, NextResponse } from 'next/server';
import { searchYouTubeScraper } from '@/server/youtube';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json([]);

  try {
    const videos = await searchYouTubeScraper(q);
    return NextResponse.json(videos);
  } catch (err) {
    console.error('yt-search fallback failed:', err);
    return NextResponse.json({ error: 'scrape_failed' }, { status: 500 });
  }
}
