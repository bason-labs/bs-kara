import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// In-memory unstable_cache stand-in: dedups by (keyParts, args) so the
// route's caching path is exercised in tests, but cleared in beforeEach so
// no test leaks state to its neighbors.
const { cacheStore } = vi.hoisted(() => ({
  cacheStore: new Map<string, unknown>(),
}));
vi.mock('next/cache', () => ({
  unstable_cache: <Args extends unknown[], R>(
    fn: (...args: Args) => Promise<R>,
    keyParts?: string[],
  ) => async (...args: Args): Promise<R> => {
    const key = JSON.stringify([keyParts ?? [], args]);
    if (cacheStore.has(key)) return cacheStore.get(key) as R;
    const result = await fn(...args);
    cacheStore.set(key, result);
    return result;
  },
}));

import { GET } from './route';

function makeReq(q?: string) {
  const url = q !== undefined
    ? `http://localhost/api/suggestions?q=${encodeURIComponent(q)}`
    : 'http://localhost/api/suggestions';
  return new NextRequest(url);
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  cacheStore.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function utf8ToLatin1Buffer(s: string): ArrayBuffer {
  // Emulate Google's "declared latin-1 / actually latin-1 bytes" payload.
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
  return bytes.buffer;
}

describe('GET /api/suggestions', () => {
  it('returns empty list for missing q', async () => {
    const res = await GET(makeReq());
    expect(await res.json()).toEqual({ suggestions: [] });
  });

  it('returns the Google suggestions array when upstream is ok', async () => {
    const payload = JSON.stringify(['hello', ['hello karaoke', 'hello beat']]);
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => utf8ToLatin1Buffer(payload),
    });
    const res = await GET(makeReq('hello'));
    expect(await res.json()).toEqual({
      suggestions: ['hello karaoke', 'hello beat'],
    });
  });

  it('returns empty list for non-array upstream payloads', async () => {
    const payload = JSON.stringify(['hello', 'not-an-array']);
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => utf8ToLatin1Buffer(payload),
    });
    const res = await GET(makeReq('hello'));
    expect(await res.json()).toEqual({ suggestions: [] });
  });

  it('returns empty list when upstream is not ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      arrayBuffer: async () => utf8ToLatin1Buffer('[]'),
    });
    const res = await GET(makeReq('hello'));
    expect(await res.json()).toEqual({ suggestions: [] });
  });

  it('swallows fetch failures and returns empty list', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const res = await GET(makeReq('hello'));
    expect(await res.json()).toEqual({ suggestions: [] });
  });

  it('decodes latin-1 bytes back into a NFC-normalized Vietnamese string', async () => {
    // 0xF3 = "ó" in latin-1; embedded directly in raw bytes.
    const raw = '["q",["nh\xF3m karaoke"]]';
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => utf8ToLatin1Buffer(raw),
    });
    const res = await GET(makeReq('q'));
    const data = (await res.json()) as { suggestions: string[] };
    expect(data.suggestions[0]).toBe('nhóm karaoke');
  });

  it('caches identical queries across requests', async () => {
    const payload = JSON.stringify(['hi', ['hi karaoke', 'hi beat']]);
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => utf8ToLatin1Buffer(payload),
    });
    const r1 = await GET(makeReq('hi'));
    expect(await r1.json()).toEqual({
      suggestions: ['hi karaoke', 'hi beat'],
    });
    const r2 = await GET(makeReq('hi'));
    expect(await r2.json()).toEqual({
      suggestions: ['hi karaoke', 'hi beat'],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not share cache entries across distinct queries', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () =>
          utf8ToLatin1Buffer(JSON.stringify(['a', ['alpha']])),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () =>
          utf8ToLatin1Buffer(JSON.stringify(['b', ['beta']])),
      });
    const r1 = await GET(makeReq('a'));
    const r2 = await GET(makeReq('b'));
    expect(await r1.json()).toEqual({ suggestions: ['alpha'] });
    expect(await r2.json()).toEqual({ suggestions: ['beta'] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache upstream errors so retries can succeed', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        arrayBuffer: async () => utf8ToLatin1Buffer('[]'),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () =>
          utf8ToLatin1Buffer(JSON.stringify(['retry', ['retry karaoke']])),
      });
    const r1 = await GET(makeReq('retry'));
    expect(await r1.json()).toEqual({ suggestions: [] });
    const r2 = await GET(makeReq('retry'));
    expect(await r2.json()).toEqual({ suggestions: ['retry karaoke'] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
