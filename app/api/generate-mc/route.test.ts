import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

function makeReq(body?: unknown) {
  // Inferred init type avoids DOM RequestInit's `signal: ... | null` shape
  // which NextRequest's stricter type rejects.
  const init = body !== undefined
    ? { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }
    : { method: 'POST' };
  return new NextRequest('http://localhost/api/generate-mc', init);
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  process.env.OPENAI_API_KEY = 'openai-key';
  process.env.GEMINI_API_KEY = 'gemini-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.AI_MC_PROVIDER;
});

function openaiResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  };
}

function geminiResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  };
}

describe('POST /api/generate-mc', () => {
  it('returns 400 when songTitle is missing', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ text: null });
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeReq('not-json'));
    expect(res.status).toBe(400);
  });

  it('returns 502 for an unsupported provider', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.AI_MC_PROVIDER = 'nope';
    const res = await POST(makeReq({ songTitle: 'X' }));
    expect(res.status).toBe(502);
  });

  // Documentation states OpenAI is the default. The route must honor that
  // when AI_MC_PROVIDER is unset, an empty string, or whitespace — without
  // requiring the env var to be set in every deployment.
  it('defaults to OpenAI when AI_MC_PROVIDER is unset', async () => {
    delete process.env.AI_MC_PROVIDER;
    fetchMock.mockResolvedValue(openaiResponse('Hi from default'));
    const res = await POST(makeReq({ songTitle: 'X' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'Hi from default' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.openai.com');
  });

  it('defaults to OpenAI when AI_MC_PROVIDER is the empty string', async () => {
    process.env.AI_MC_PROVIDER = '';
    fetchMock.mockResolvedValue(openaiResponse('Hi from empty'));
    const res = await POST(makeReq({ songTitle: 'X' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'Hi from empty' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.openai.com');
  });

  it('defaults to OpenAI when AI_MC_PROVIDER is only whitespace', async () => {
    process.env.AI_MC_PROVIDER = '   ';
    fetchMock.mockResolvedValue(openaiResponse('Hi from spaces'));
    const res = await POST(makeReq({ songTitle: 'X' }));
    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.openai.com');
  });

  it('returns OpenAI text on success', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('Welcome to the show!'));
    const res = await POST(makeReq({ songTitle: 'X', singerName: 'A' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'Welcome to the show!' });
  });

  it('returns Gemini text on success', async () => {
    process.env.AI_MC_PROVIDER = 'gemini';
    fetchMock.mockResolvedValue(geminiResponse('Hello hello'));
    const res = await POST(makeReq({ songTitle: 'X' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'Hello hello' });
  });

  it('strips emoji, parens, and markdown punctuation from the model output', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(
      openaiResponse('🔥 *Hello* (cười lớn) "world"!'),
    );
    const res = await POST(makeReq({ songTitle: 'X' }));
    const data = (await res.json()) as { text: string };
    expect(data.text).not.toMatch(/[🔥*"()]/);
    expect(data.text).toContain('Hello');
    expect(data.text).toContain('world');
  });

  it('returns 502 when sanitizer leaves the text empty', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('🔥🔥🔥')); // all stripped
    const res = await POST(makeReq({ songTitle: 'X' }));
    expect(res.status).toBe(502);
  });

  it('returns 502 when OpenAI returns non-ok', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const res = await POST(makeReq({ songTitle: 'X' }));
    expect(res.status).toBe(502);
  });

  it('returns 502 when fetch throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockRejectedValue(new Error('network'));
    const res = await POST(makeReq({ songTitle: 'X' }));
    expect(res.status).toBe(502);
  });
});
