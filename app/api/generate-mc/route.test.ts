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

  // Regression: when the user enters more than one singer (e.g. "Nguyễn Văn A,
  // Nguyễn Văn B"), the model used to receive a single `Tên ca sĩ: "..."`
  // slot framed by a singular persona and would often introduce only the first
  // name. The user prompt must now enumerate every singer and explicitly
  // instruct the model to introduce all of them.
  function getOpenAIUserMessage(): string {
    const init = fetchMock.mock.calls[0][1] as { body: string };
    const parsed = JSON.parse(init.body) as {
      messages: { role: string; content: string }[];
    };
    const userMsg = parsed.messages.find((m) => m.role === 'user');
    return userMsg?.content ?? '';
  }

  it('introduces every singer when multiple comma-separated names are provided', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('intro for both'));
    await POST(
      makeReq({ songTitle: 'X', singerName: 'Nguyễn Văn A, Nguyễn Văn B' }),
    );
    const userMsg = getOpenAIUserMessage();
    expect(userMsg).toContain('Nguyễn Văn A');
    expect(userMsg).toContain('Nguyễn Văn B');
    expect(userMsg).toMatch(/2/);
    expect(userMsg.toLowerCase()).toMatch(/tất cả|all/);
  });

  it('introduces every singer when names are joined by "&" or "và"', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('ok'));
    await POST(
      makeReq({ songTitle: 'X', singerName: 'An & Bình và Cường' }),
    );
    const userMsg = getOpenAIUserMessage();
    expect(userMsg).toContain('An');
    expect(userMsg).toContain('Bình');
    expect(userMsg).toContain('Cường');
    expect(userMsg).toMatch(/3/);
    expect(userMsg.toLowerCase()).toMatch(/tất cả|all/);
  });

  it('keeps the single-singer prompt shape when only one name is provided', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('ok'));
    await POST(makeReq({ songTitle: 'X', singerName: 'Nguyễn Văn A' }));
    const userMsg = getOpenAIUserMessage();
    expect(userMsg).toContain('Tên ca sĩ: "Nguyễn Văn A"');
  });

  function getOpenAISystemMessage(): string {
    const init = fetchMock.mock.calls[0][1] as { body: string };
    const parsed = JSON.parse(init.body) as {
      messages: { role: string; content: string }[];
    };
    return parsed.messages.find((m) => m.role === 'system')?.content ?? '';
  }

  // Locks in the style-rotation persona so a future "tighten the prompt"
  // pass can't silently flatten the MC back to a generic single-style voice.
  // Without this, users complained the MC never produced poetry or other
  // creative styles even though the persona claimed it could.
  it('mandates style rotation with a concrete style menu in the system prompt', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('ok'));
    await POST(makeReq({ songTitle: 'X' }));
    const sys = getOpenAISystemMessage();
    expect(sys).toMatch(/lục bát/i);
    // At least two additional distinct creative styles must remain in the
    // menu, otherwise variety collapses.
    const otherStyles = ['rap', 'gen z', 'bóng đá', 'tin nóng', 'đám cưới', 'kiếm hiệp'];
    const matched = otherStyles.filter((s) => sys.toLowerCase().includes(s));
    expect(matched.length).toBeGreaterThanOrEqual(2);
  });

  // Users complained the MC announcements ended without inviting the singer
  // to the stage ("just floats off without a 'your turn' cue"). The persona
  // must require a closing invitation phrase and supply a varied sample bank
  // so the model rotates phrases instead of always saying "Xin mời".
  it('requires a closing invitation phrase with a varied sample bank', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('ok'));
    await POST(makeReq({ songTitle: 'X' }));
    const sys = getOpenAISystemMessage();
    // The rule itself
    expect(sys.toLowerCase()).toMatch(/mời.*lên sân khấu|câu mời/);
    // A handful of distinct invitation samples — at least three so the model
    // has variety to rotate through.
    const invitationSamples = [
      'Xin mời',
      'cất tiếng hót',
      'Mic là của bạn',
      'chiến binh ra trận',
      'toả sáng',
      'quẩy lên',
      'vỗ tay đón',
    ];
    const matched = invitationSamples.filter((s) => sys.includes(s));
    expect(matched.length).toBeGreaterThanOrEqual(3);
  });
});
