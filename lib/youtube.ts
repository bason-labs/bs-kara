export interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  // Singer's name attached when the song was added to the queue. Optional
  // because search results don't have one and auto-random picks bypass the
  // requester prompt entirely.
  requesterName?: string;
}

export interface QueueItem extends YouTubeVideo {
  queueId: string;
}

export type SingerType = 'all' | 'solo' | 'duet';
export type Tone = 'all' | 'male' | 'female';
export type Genre = 'all' | 'bolero' | 'caco' | 'tre';

export interface RandomFilters {
  type: SingerType;
  tone: Tone;
  genre: Genre;
}

export const DEFAULT_RANDOM_FILTERS: RandomFilters = {
  type: 'all',
  tone: 'all',
  genre: 'all',
};

export type SearchError = 'quota' | 'generic';

export interface SearchResult {
  videos: YouTubeVideo[];
  error?: SearchError;
}

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
