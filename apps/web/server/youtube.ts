import 'server-only';
import ytSearch from 'yt-search';
// yt-search loads these at runtime with require() through a wrapper the build
// can't see. Requiring them here (CommonJS, like yt-search does) makes the build
// copy their CommonJS files into the server output; without this, every route
// using this module fails with "Cannot find module 'cheerio'".
/* eslint-disable @typescript-eslint/no-require-imports */
require('cheerio');
require('dasu');
require('async.parallellimit');
require('human-time');
require('jsonpath-plus');
/* eslint-enable @typescript-eslint/no-require-imports */
import { unstable_cache } from 'next/cache';
import type { YouTubeVideo } from '@bs-kara/shared';
import { normalizeDiacritics } from '@bs-kara/shared';
import { recordSearchLive, recordSearchTotal } from '@/server/analytics';

const YOUTUBE_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';
const CACHE_REVALIDATE_SECONDS = 3600;

export class QuotaExhaustedError extends Error {
  constructor() {
    super('All YouTube API keys returned 403');
    this.name = 'QuotaExhaustedError';
  }
}

// Normalises both diacritics and whitespace so equivalent spellings map to a
// single cache entry. The whitespace collapse is BFF-specific (cache-key only)
// and intentionally kept on top of the shared normaliser.
export function normalizeQuery(q: string): string {
  return normalizeDiacritics(q).replace(/\s+/g, ' ');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function loadKeys(): string[] {
  const raw = process.env.YOUTUBE_API_KEYS ?? '';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

type YouTubeApiItem = {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { medium: { url: string } };
  };
};

// Module-scope cursor remembers which key last succeeded so subsequent
// cache-cold requests in the same warm function instance skip keys that
// are already known to be 403'd. Resets back to 0 once the cursor advances
// past the configured key list (e.g. env rotation, new key appended).
let nextKeyIndex = 0;

export function __resetKeyCursorForTests() {
  nextKeyIndex = 0;
}

async function tryAllKeys(query: string): Promise<YouTubeVideo[]> {
  const keys = loadKeys();
  if (keys.length === 0) {
    throw new Error('YOUTUBE_API_KEYS is not configured');
  }

  const baseParams = {
    part: 'snippet',
    maxResults: '15',
    type: 'video',
    videoEmbeddable: 'true',
    q: `${query} karaoke beat`,
  };

  // Start at the last-known-good cursor; clamp if the env shrunk under us.
  const start = nextKeyIndex < keys.length ? nextKeyIndex : 0;
  for (let n = 0; n < keys.length; n++) {
    const i = (start + n) % keys.length;
    const params = new URLSearchParams({ ...baseParams, key: keys[i] });
    const res = await fetch(`${YOUTUBE_ENDPOINT}?${params}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });

    if (res.status === 403) {
      console.warn(`[youtube-bff] key index ${i} returned 403; rotating`);
      continue;
    }
    if (!res.ok) {
      throw new Error(`YouTube API returned ${res.status}`);
    }

    nextKeyIndex = i;
    recordSearchLive();
    const data: { items?: YouTubeApiItem[] } = await res.json();
    return (data.items ?? []).map((item) => ({
      id: item.id.videoId,
      title: decodeEntities(item.snippet.title),
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium.url,
      duration: '',
    }));
  }

  throw new QuotaExhaustedError();
}

const cachedSearch = unstable_cache(
  async (normalizedQuery: string) => tryAllKeys(normalizedQuery),
  ['youtube-search'],
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: ['youtube-search'] },
);


export async function searchYouTubeApi(query: string): Promise<YouTubeVideo[]> {
  const videos = await cachedSearch(normalizeQuery(query));
  recordSearchTotal();
  return videos;
}

export async function searchYouTubeScraper(query: string): Promise<YouTubeVideo[]> {
  const result = await ytSearch(`${query} karaoke beat`);
  return (result.videos ?? []).slice(0, 15).map(v => ({
    id: v.videoId, title: v.title, channel: v.author?.name ?? '',
    thumbnail: v.thumbnail ?? '', duration: v.timestamp ?? '',
  }));
}

export async function searchYouTubeServer(query: string): Promise<YouTubeVideo[]> {
  try { return await searchYouTubeApi(query); }
  catch { return searchYouTubeScraper(query); }
}
