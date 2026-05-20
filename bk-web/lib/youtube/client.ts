import type { SearchResult, YouTubeVideo } from './types';

async function searchViaScraper(query: string): Promise<YouTubeVideo[]> {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as YouTubeVideo[]) : [];
  } catch {
    return [];
  }
}

export async function searchYouTube(query: string): Promise<SearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { videos: [] };

  try {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`);

    if (res.ok) {
      const videos = (await res.json()) as YouTubeVideo[];
      return { videos };
    }

    if (res.status === 429) {
      const fallback = await searchViaScraper(trimmed);
      if (fallback.length > 0) return { videos: fallback };
      return { videos: [], error: 'quota' };
    }

    const fallback = await searchViaScraper(trimmed);
    if (fallback.length > 0) return { videos: fallback };
    return { videos: [], error: 'generic' };
  } catch {
    const fallback = await searchViaScraper(trimmed);
    if (fallback.length > 0) return { videos: fallback };
    return { videos: [], error: 'generic' };
  }
}
