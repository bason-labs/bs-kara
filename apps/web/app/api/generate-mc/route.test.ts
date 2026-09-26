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

  // Misconfigured AI_MC_PROVIDER used to return 5xx, breaking the UI for
  // every request until the env var was fixed. The new contract: ANY
  // provider-call failure (including a misconfigured provider) returns a
  // 200 with the template-based fallback so the user never sees a failure.
  // The misconfig still gets logged so monitoring can catch it.
  it('falls back to a template MC when AI_MC_PROVIDER is unsupported', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.AI_MC_PROVIDER = 'nope';
    const res = await POST(makeReq({ songTitle: 'Giã Từ' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-MC-Source')).toBe('fallback');
    const data = (await res.json()) as { text: string };
    expect(data.text).toContain('Giã Từ');
  });

  // Documentation states OpenAI is the default. The route must honor that
  // when AI_MC_PROVIDER is unset, an empty string, or whitespace — without
  // requiring the env var to be set in every deployment.
  it.each([
    { label: 'unset', value: undefined },
    { label: 'the empty string', value: '' },
    { label: 'only whitespace', value: '   ' },
  ])('defaults to OpenAI when AI_MC_PROVIDER is $label', async ({ value }) => {
    if (value === undefined) delete process.env.AI_MC_PROVIDER;
    else process.env.AI_MC_PROVIDER = value;
    fetchMock.mockResolvedValue(openaiResponse('Hi'));
    const res = await POST(makeReq({ songTitle: 'X' }));
    expect(await res.json()).toEqual({ text: 'Hi' });
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

  it('falls back to a template MC when sanitizer leaves the text empty', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('🔥🔥🔥')); // all stripped
    const res = await POST(makeReq({ songTitle: 'Giã Từ' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-MC-Source')).toBe('fallback');
    const data = (await res.json()) as { text: string };
    expect(data.text).toContain('Giã Từ');
  });

  it('falls back to a template MC when OpenAI returns non-ok', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const res = await POST(makeReq({ songTitle: 'Giã Từ' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-MC-Source')).toBe('fallback');
    const data = (await res.json()) as { text: string };
    expect(data.text).toContain('Giã Từ');
  });

  it('falls back to a template MC when fetch throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockRejectedValue(new Error('network'));
    const res = await POST(makeReq({ songTitle: 'Giã Từ' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-MC-Source')).toBe('fallback');
    const data = (await res.json()) as { text: string };
    expect(data.text).toContain('Giã Từ');
  });

  // The original bug report: the provider call occasionally aborts (e.g.
  // upstream timeout) and the route used to surface that as a 5xx, breaking
  // the karaoke UI. After the fix, AbortError is caught and the user sees
  // a sensible MC line every time.
  it('falls back to a template MC when the provider call aborts (AbortError)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.AI_MC_PROVIDER = 'openai';
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    fetchMock.mockRejectedValue(abortErr);
    const res = await POST(makeReq({ songTitle: 'Giã Từ' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-MC-Source')).toBe('fallback');
    const data = (await res.json()) as { text: string };
    expect(data.text).toContain('Giã Từ');
  });

  it('falls back to a template MC when the provider throws a rate-limit error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockRejectedValue(new Error('rate limit'));
    const res = await POST(makeReq({ songTitle: 'Giã Từ' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-MC-Source')).toBe('fallback');
    const data = (await res.json()) as { text: string };
    expect(data.text).toContain('Giã Từ');
  });

  // Successful LLM responses must be tagged so the client/logs can
  // distinguish AI-generated MC lines from template fallbacks. Without
  // this header, monitoring can't tell whether the provider is healthy.
  it('marks successful LLM responses with X-MC-Source: llm', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('Welcome to the show!'));
    const res = await POST(makeReq({ songTitle: 'X' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-MC-Source')).toBe('llm');
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

  it('introduces every performer when multiple comma-separated names are provided', async () => {
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

  it('introduces every performer when names are joined by "&" or "và"', async () => {
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

  it('keeps the single-performer prompt shape when only one name is provided', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('ok'));
    await POST(makeReq({ songTitle: 'X', singerName: 'Nguyễn Văn A' }));
    const userMsg = getOpenAIUserMessage();
    expect(userMsg).toContain('Người được mời lên hát: "Nguyễn Văn A"');
  });

  // performerName is the new canonical field; singerName is the legacy alias
  // that older callers (hooks/useRoom/mc.ts, hooks/useMCPlayer.ts) still
  // send. When both are present, performerName wins.
  it('prefers performerName over the legacy singerName alias when both are sent', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('ok'));
    await POST(
      makeReq({ songTitle: 'X', performerName: 'New Name', singerName: 'Old Name' }),
    );
    const userMsg = getOpenAIUserMessage();
    expect(userMsg).toContain('Người được mời lên hát: "New Name"');
    expect(userMsg).not.toContain('Old Name');
  });

  // Case A: every variable in the new prompt-template table is supplied —
  // the rendered user message must include the labelled line for each.
  it('renders all variable lines when song_title + original_artist + performer_name + flavor + recent_styles are present (Case A)', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('ok'));
    await POST(
      makeReq({
        songTitle: 'Diễm Xưa',
        originalArtist: 'Khánh Ly',
        performerName: 'Anh Tuấn',
        composer: 'Trịnh Công Sơn',
        genre: 'ballad',
        mood: 'hoài niệm',
        context: 'cafe',
        recentStyles: ['SANG TRỌNG', 'TRẺ TRUNG'],
      }),
    );
    const userMsg = getOpenAIUserMessage();
    expect(userMsg).toContain('Tên bài hát: "Diễm Xưa"');
    expect(userMsg).toContain('Ca sĩ trình bày gốc: "Khánh Ly"');
    expect(userMsg).toContain('Người được mời lên hát: "Anh Tuấn"');
    expect(userMsg).toContain('Nhạc sĩ sáng tác: "Trịnh Công Sơn"');
    expect(userMsg).toContain('Thể loại: "ballad"');
    expect(userMsg).toContain('Tâm trạng bài hát: "hoài niệm"');
    expect(userMsg).toContain('Bối cảnh chương trình: "cafe"');
    expect(userMsg).toContain('Các phong cách vừa dùng');
    expect(userMsg).toContain('"SANG TRỌNG"');
    expect(userMsg).toContain('"TRẺ TRUNG"');
  });

  // Case B: only song_title is supplied — flavor variables (composer, genre,
  // mood, context, recentStyles) are still dropped, but artist/performer
  // lines stay in with explicit "no name — don't fabricate" notices (see
  // the anti-fabrication regression test below for the reason).
  it('omits missing FLAVOR lines while keeping anti-fabrication notices for artist/performer (Case B)', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('ok'));
    await POST(makeReq({ songTitle: 'Anh Cứ Đi Đi' }));
    const userMsg = getOpenAIUserMessage();
    expect(userMsg).toContain('Tên bài hát: "Anh Cứ Đi Đi"');
    // Flavor labels (composer/genre/mood/context/recentStyles) must be
    // absent when not supplied — they're optional context the model can do
    // without.
    expect(userMsg).not.toContain('Nhạc sĩ sáng tác');
    expect(userMsg).not.toContain('Thể loại');
    expect(userMsg).not.toContain('Tâm trạng');
    expect(userMsg).not.toContain('Bối cảnh');
    expect(userMsg).not.toContain('Các phong cách vừa dùng');
    // No leaked literal nulls / undefined / empty quotes anywhere.
    expect(userMsg).not.toMatch(/null|undefined|: ""/);
  });

  // Regression: model was hallucinating performer/artist names when the
  // fields were absent, e.g. POST { songTitle: "Giã Từ" } produced output
  // mentioning "anh Hải và chị Lan". Empty lines in the user message let
  // the model fall back to its few-shot pattern (most examples have named
  // performers). The fix is to KEEP the artist/performer lines in the
  // rendered prompt but with an explicit "no name — don't fabricate" notice
  // that overrides the pattern. This test snapshots the rendered prompt to
  // catch any future change that silently drops those notices.
  it('does not let the LLM fabricate names by sending explicit anti-fabrication notices when artist/performer are missing', async () => {
    process.env.AI_MC_PROVIDER = 'openai';
    fetchMock.mockResolvedValue(openaiResponse('ok'));
    await POST(makeReq({ songTitle: 'Giã Từ' }));
    const userMsg = getOpenAIUserMessage();
    expect(userMsg).toContain('Giã Từ');
    expect(userMsg).toContain(
      'KHÔNG có tên — dùng cụm chung, KHÔNG được bịa tên người',
    );
    expect(userMsg).toContain('KHÔNG được nhắc tên ca sĩ nào');
  });
});
