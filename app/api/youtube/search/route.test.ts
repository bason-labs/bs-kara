import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Bypass unstable_cache so each test sees a fresh upstream call.
vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

import { GET } from './route';

function makeReq(q: string) {
  return new NextRequest(`http://localhost/api/youtube/search?q=${encodeURIComponent(q)}`);
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  process.env.YOUTUBE_API_KEYS = 'key-1,key-2,key-3';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function ytItem(id: string, title = 'X') {
  return {
    id: { videoId: id },
    snippet: {
      title,
      channelTitle: 'channel',
      thumbnails: { medium: { url: `https://example.com/${id}.jpg` } },
    },
  };
}

describe('GET /api/youtube/search', () => {
  it('returns 400 when q is missing or only whitespace', async () => {
    const res = await GET(makeReq('   '));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'missing_query' });
  });

  it('returns mapped videos on a 200 upstream', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [ytItem('abc', 'Hello')] }),
    });
    const res = await GET(makeReq('hi'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: 'abc',
        title: 'Hello',
        channel: 'channel',
        thumbnail: 'https://example.com/abc.jpg',
        duration: '',
      },
    ]);
  });

  it('rotates to the next key on 403 and succeeds', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [ytItem('zzz')] }),
      });
    const res = await GET(makeReq('hi'));
    expect(res.status).toBe(200);
    const calls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(calls[0]).toContain('key=key-1');
    expect(calls[1]).toContain('key=key-2');
  });

  it('returns 429 quota_exhausted when every key returns 403', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const res = await GET(makeReq('hi'));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'quota_exhausted' });
  });

  it('returns 500 search_failed for non-403 upstream errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const res = await GET(makeReq('hi'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'search_failed' });
  });

  it('returns 500 when YOUTUBE_API_KEYS is not configured', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.YOUTUBE_API_KEYS = '';
    const res = await GET(makeReq('hi'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'search_failed' });
  });

  it('decodes HTML entities in the title', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [ytItem('x', 'Smith &amp; Jones &#39;Hi&#39;')] }),
    });
    const res = await GET(makeReq('hi'));
    const [v] = (await res.json()) as Array<{ title: string }>;
    expect(v.title).toBe("Smith & Jones 'Hi'");
  });

  it('appends "karaoke beat" to the upstream q parameter', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });
    await GET(makeReq('lệ lưu ly'));
    const url = String(fetchMock.mock.calls[0][0]);
    // normalizeQuery strips diacritics → "le luu ly"; route appends " karaoke beat"
    expect(url).toMatch(/q=le\+luu\+ly\+karaoke\+beat/);
  });
});
