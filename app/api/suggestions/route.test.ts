import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
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
});
