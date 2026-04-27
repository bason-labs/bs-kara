import { NextRequest, NextResponse } from 'next/server';
import ytSearch from 'yt-search';
import type { YouTubeVideo } from '@/lib/youtube';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json([]);

  try {
    const result = await ytSearch(`${q} karaoke beat`);
    const videos: YouTubeVideo[] = (result.videos ?? []).slice(0, 15).map((v) => ({
      id: v.videoId,
      title: v.title,
      channel: v.author?.name ?? '',
      thumbnail: v.thumbnail ?? '',
      duration: v.timestamp ?? '',
    }));
    return NextResponse.json(videos);
  } catch (err) {
    console.error('yt-search fallback failed:', err);
    return NextResponse.json({ error: 'scrape_failed' }, { status: 500 });
  }
}
