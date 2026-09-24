import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/msw/server';
import { searchYouTube } from './client';

describe('searchYouTube', () => {
  it('returns an empty videos array for blank queries', async () => {
    const result = await searchYouTube('   ');
    expect(result).toEqual({ videos: [] });
  });

  it('returns BFF videos on a 200 response', async () => {
    const result = await searchYouTube('hello');
    expect(result.error).toBeUndefined();
    expect(result.videos.length).toBeGreaterThan(0);
    expect(result.videos[0].id).toBe('mock-video-1');
  });

  it('falls back to scraper when BFF returns 429 with results', async () => {
    server.use(
      http.get('*/api/youtube/search', () =>
        HttpResponse.json({ error: 'quota' }, { status: 429 }),
      ),
    );
    const result = await searchYouTube('hello');
    expect(result.error).toBeUndefined();
    expect(result.videos[0].id).toBe('mock-scrape-1');
  });

  it('reports quota error when BFF 429 and scraper returns nothing', async () => {
    server.use(
      http.get('*/api/youtube/search', () =>
        HttpResponse.json({ error: 'quota' }, { status: 429 }),
      ),
      http.get('*/api/search', () => HttpResponse.json([])),
    );
    const result = await searchYouTube('hello');
    expect(result).toEqual({ videos: [], error: 'quota' });
  });

  it('falls back to scraper on 5xx and reports generic error if scraper empty', async () => {
    server.use(
      http.get('*/api/youtube/search', () => HttpResponse.error()),
      http.get('*/api/search', () => HttpResponse.json([])),
    );
    const result = await searchYouTube('hello');
    expect(result).toEqual({ videos: [], error: 'generic' });
  });

  it('uses scraper when BFF throws (network error)', async () => {
    server.use(http.get('*/api/youtube/search', () => HttpResponse.error()));
    const result = await searchYouTube('hello');
    expect(result.videos[0].id).toBe('mock-scrape-1');
  });

  it('returns generic error when BFF returns non-429 non-ok and scraper also fails', async () => {
    server.use(
      http.get('*/api/youtube/search', () =>
        HttpResponse.json({ error: 'broken' }, { status: 500 }),
      ),
      http.get('*/api/search', () => HttpResponse.json([])),
    );
    const result = await searchYouTube('hello');
    expect(result).toEqual({ videos: [], error: 'generic' });
  });
});
