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

import { POST } from './route';

function makeReq(body?: unknown) {
  // Inferred init type avoids DOM RequestInit's `signal: ... | null` shape
  // which NextRequest's stricter type rejects.
  const init = body !== undefined
    ? { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }
    : { method: 'POST' };
  return new NextRequest('http://localhost/api/tts', init);
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  process.env.GOOGLE_TTS_API_KEY = 'test-key';
  cacheStore.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/tts', () => {
  it('returns 400 when text is missing', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ audioContent: null });
  });

  it('returns 400 when body JSON is malformed', async () => {
    const res = await POST(makeReq('not-json'));
    expect(res.status).toBe(400);
  });

  it('returns 503 when GOOGLE_TTS_API_KEY is unset', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.GOOGLE_TTS_API_KEY;
    const res = await POST(makeReq({ text: 'hello' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'tts_not_configured' });
  });

  it('returns audioContent on a successful upstream call', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ audioContent: 'BASE64' }),
    });
    const res = await POST(makeReq({ text: 'hello' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ audioContent: 'BASE64' });
  });

  it('rejects non-whitelisted voice names by substituting the default', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ audioContent: 'X' }),
    });
    await POST(makeReq({ text: 'hi', voiceName: 'evil-voice' }));
    const sentBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(sentBody.voice.name).toBe('vi-VN-Neural2-A');
  });

  it('passes through whitelisted voice names', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ audioContent: 'X' }),
    });
    await POST(makeReq({ text: 'hi', voiceName: 'vi-VN-Wavenet-C' }));
    const sentBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(sentBody.voice.name).toBe('vi-VN-Wavenet-C');
  });

  it('mirrors Google 429 status when quota is exhausted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    const res = await POST(makeReq({ text: 'hi' }));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'google_tts_failed' });
  });

  it('returns 502 when Google returns a non-HTTP-status error code', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue({
      ok: false,
      status: 999, // outside 400..599
      json: async () => ({}),
    });
    const res = await POST(makeReq({ text: 'hi' }));
    expect(res.status).toBe(502);
  });

  it('returns 502 when audioContent is missing in success body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    const res = await POST(makeReq({ text: 'hi' }));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'empty_audio' });
  });

  it('returns 502 when fetch throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error('network'));
    const res = await POST(makeReq({ text: 'hi' }));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'synthesis_error' });
  });

  // The 4 voice-preview samples × 4 voices in the Settings sheet are fully
  // deterministic, so repeated previews of the same selection should be
  // served from cache rather than burning Google quota. Same applies to MC
  // lines that happen to repeat (rare but free).
  it('caches identical (text, voice) calls across requests', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ audioContent: 'BASE64' }),
    });
    const r1 = await POST(
      makeReq({ text: 'hello world', voiceName: 'vi-VN-Wavenet-C' }),
    );
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ audioContent: 'BASE64' });
    const r2 = await POST(
      makeReq({ text: 'hello world', voiceName: 'vi-VN-Wavenet-C' }),
    );
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ audioContent: 'BASE64' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not share cache entries across distinct voices', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ audioContent: 'A' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ audioContent: 'B' }),
      });
    const r1 = await POST(
      makeReq({ text: 'same', voiceName: 'vi-VN-Wavenet-C' }),
    );
    const r2 = await POST(
      makeReq({ text: 'same', voiceName: 'vi-VN-Neural2-D' }),
    );
    expect(await r1.json()).toEqual({ audioContent: 'A' });
    expect(await r2.json()).toEqual({ audioContent: 'B' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache upstream errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ audioContent: 'AFTER' }),
      });
    const fail = await POST(
      makeReq({ text: 'flaky', voiceName: 'vi-VN-Wavenet-C' }),
    );
    expect(fail.status).toBe(429);
    const ok = await POST(
      makeReq({ text: 'flaky', voiceName: 'vi-VN-Wavenet-C' }),
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ audioContent: 'AFTER' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
