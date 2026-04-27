export interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
}

export interface QueueItem extends YouTubeVideo {
  queueId: string;
}

function decodeHTMLEntities(text: string): string {
  if (typeof document === 'undefined') return text;
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
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

export async function searchYouTube(query: string): Promise<YouTubeVideo[]> {
  const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('NEXT_PUBLIC_YOUTUBE_API_KEY is not set');
    return searchViaScraper(query);
  }

  const params = new URLSearchParams({
    part: 'snippet',
    maxResults: '15',
    type: 'video',
    videoEmbeddable: 'true',
    q: `${query} karaoke beat`,
    key: apiKey,
  });

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`,
    );
    if (res.status === 403) {
      console.warn('YouTube API quota exceeded. Falling back to internal scraper...');
      return searchViaScraper(query);
    }
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map(
      (item: {
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          thumbnails: { medium: { url: string } };
        };
      }) => ({
        id: item.id.videoId,
        title: decodeHTMLEntities(item.snippet.title),
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium.url,
        duration: '',
      }),
    );
  } catch {
    return searchViaScraper(query);
  }
}
