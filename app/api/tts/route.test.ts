import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
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
});
