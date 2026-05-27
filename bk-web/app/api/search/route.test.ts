import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('yt-search', () => ({ default: vi.fn() }));
import ytSearch from 'yt-search';
import { GET } from './route';

const ytMock = ytSearch as unknown as ReturnType<typeof vi.fn>;

afterEach(() => vi.restoreAllMocks());

function makeReq(q?: string) {
  const url = q !== undefined
    ? `http://localhost/api/search?q=${encodeURIComponent(q)}`
    : 'http://localhost/api/search';
  return new NextRequest(url);
}

describe('GET /api/search', () => {
  it('returns [] for blank or missing q', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('maps the yt-search result shape into YouTubeVideo', async () => {
    ytMock.mockResolvedValue({
      videos: [
        {
          videoId: 'abc',
          title: 'Title 1',
          author: { name: 'Channel 1' },
          thumbnail: 'https://example.com/t.jpg',
          timestamp: '3:45',
        },
      ],
    });
    const res = await GET(makeReq('hello'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: 'abc',
        title: 'Title 1',
        channel: 'Channel 1',
        thumbnail: 'https://example.com/t.jpg',
        duration: '3:45',
      },
    ]);
  });

  it('appends "karaoke beat" to the query passed to yt-search', async () => {
    ytMock.mockResolvedValue({ videos: [] });
    await GET(makeReq('foo'));
    expect(ytMock).toHaveBeenCalledWith('foo karaoke beat');
  });

  it('caps results at 15', async () => {
    ytMock.mockResolvedValue({
      videos: Array.from({ length: 30 }, (_, i) => ({
        videoId: `v${i}`,
        title: `t${i}`,
        author: { name: 'c' },
        thumbnail: '',
        timestamp: '',
      })),
    });
    const res = await GET(makeReq('many'));
    const data = (await res.json()) as unknown[];
    expect(data.length).toBe(15);
  });

  it('returns 500 when yt-search throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    ytMock.mockRejectedValue(new Error('boom'));
    const res = await GET(makeReq('hello'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'scrape_failed' });
  });

  it('uses empty fallbacks for missing video fields', async () => {
    ytMock.mockResolvedValue({
      videos: [{ videoId: 'x', title: 't' }],
    });
    const res = await GET(makeReq('hello'));
    const [v] = (await res.json()) as Array<Record<string, unknown>>;
    expect(v).toEqual({ id: 'x', title: 't', channel: '', thumbnail: '', duration: '' });
  });
});
