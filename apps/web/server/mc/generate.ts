import 'server-only';
import { buildFallbackMC, splitPerformers } from './fallback';
import { PERSONA } from './persona';

const TIMEOUT_MS = 4000;

export interface MCVars {
  songTitle: string;
  originalArtist: string | null;
  performerName: string | null;
  composer: string | null;
  genre: string | null;
  mood: string | null;
  context: string | null;
  recentStyles: string[];
}

function buildUserPrompt(vars: MCVars): string {
  const lines: string[] = ['# DỮ LIỆU TIẾT MỤC'];

  // song_title is always present (route returns 400 otherwise).
  lines.push(`- Tên bài hát: "${vars.songTitle}"`);

  // Always render the artist + performer lines, even when missing. Empty
  // lines silently let the LLM fall back to its few-shot pattern (most
  // examples have named performers) and hallucinate names. Explicit "no
  // name" notices override the pattern. See the anti-fabrication regression
  // test in app/api/generate-mc/route.test.ts.
  if (vars.originalArtist) {
    lines.push(`- Ca sĩ trình bày gốc: "${vars.originalArtist}"`);
  } else {
    lines.push(`- Ca sĩ trình bày gốc: (KHÔNG có — KHÔNG được nhắc tên ca sĩ nào)`);
  }

  if (vars.performerName) {
    const performers = splitPerformers(vars.performerName);
    if (performers.length > 1) {
      // Enumerate every performer so the model can't collapse them into one
      // slot and skip the rest. See app/api/generate-mc/route.test.ts regression tests.
      const list = performers.map((s) => `"${s}"`).join(', ');
      lines.push(
        `- Người được mời lên hát (${performers.length} người, BẮT BUỘC giới thiệu TẤT CẢ, không bỏ sót ai): ${list}`,
      );
    } else {
      lines.push(`- Người được mời lên hát: "${vars.performerName}"`);
    }
  } else {
    lines.push(`- Người được mời lên hát: (KHÔNG có tên — dùng cụm chung, KHÔNG được bịa tên người)`);
  }

  if (vars.composer) lines.push(`- Nhạc sĩ sáng tác: "${vars.composer}"`);
  if (vars.genre) lines.push(`- Thể loại: "${vars.genre}"`);
  if (vars.mood) lines.push(`- Tâm trạng bài hát: "${vars.mood}"`);
  if (vars.context) lines.push(`- Bối cảnh chương trình: "${vars.context}"`);

  if (vars.recentStyles.length > 0) {
    const styleList = vars.recentStyles.map((s) => `"${s}"`).join(', ');
    lines.push(`- Các phong cách vừa dùng (TRÁNH lặp lại): ${styleList}`);
  }

  lines.push('', 'Lên kịch bản đi MC!');
  return lines.join('\n');
}

async function callOpenAI(vars: MCVars, signal: AbortSignal): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.9,
      max_tokens: 160,
      messages: [
        { role: 'system', content: PERSONA },
        { role: 'user', content: buildUserPrompt(vars) },
      ],
    }),
    signal,
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('OpenAI returned empty content');
  }
  return text;
}

async function callGemini(vars: MCVars, signal: AbortSignal): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PERSONA }] },
      contents: [
        {
          role: 'user',
          parts: [{ text: buildUserPrompt(vars) }],
        },
      ],
      generationConfig: { temperature: 0.9, maxOutputTokens: 160 },
    }),
    signal,
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p: { text?: string }) => p?.text ?? '').join('').trim()
    : '';
  if (!text) throw new Error('Gemini returned empty content');
  return text;
}

// Strip characters the TTS engine reads awkwardly even when the model is told
// not to emit them. Belt-and-suspenders against persona drift:
// - emoji + zero-width joiners + variation selectors → TTS reads them as
//   garbled tokens or skips entire phrases
// - parenthetical stage directions like "(cười)", "(vỗ tay)" → the model
//   was told not to produce these but sometimes does anyway
// - markdown / quote characters → leak through as literal punctuation
function sanitizeForTTS(text: string): string {
  return text
    .replace(/\([^)]*\)/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[‍️]/g, '')
    .replace(/["'`*_~#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type MCSource = 'llm' | 'fallback';

/**
 * One MC intro line for `vars`. Never throws: any provider problem (missing key,
 * timeout, bad response, empty text after sanitising, unknown provider) falls back
 * to a template line, so the karaoke UI never sees a hard failure.
 */
export async function generateMC(vars: MCVars): Promise<{ text: string; source: MCSource }> {
  // Empty / unset / whitespace → default to OpenAI (the documented default
  // in CLAUDE.md). Any non-empty unrecognized value still falls through to
  // the explicit `Unsupported AI_MC_PROVIDER` throw below so a typo can't
  // silently switch providers.
  const provider =
    (process.env.AI_MC_PROVIDER ?? '').toLowerCase().trim() || 'openai';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let text: string;
    if (provider === 'openai') {
      text = await callOpenAI(vars, controller.signal);
    } else if (provider === 'gemini') {
      text = await callGemini(vars, controller.signal);
    } else {
      throw new Error(`Unsupported AI_MC_PROVIDER: "${provider}"`);
    }
    const cleaned = sanitizeForTTS(text);
    // An empty post-sanitize result is treated as a generation failure
    // and falls through to the same template fallback as a thrown error.
    // Throwing keeps a single fallback path instead of two.
    if (!cleaned) throw new Error('sanitized output was empty');
    return { text: cleaned, source: 'llm' };
  } catch (err) {
    // ANY provider-call error (AbortError, timeout, rate limit, parse error,
    // empty post-sanitize, misconfigured provider) returns a template-based
    // MC line. Logged with a distinctive prefix so monitoring can graph
    // fallback rate without paging on it.
    console.error('[generate-mc] fallback used:', err);
    return { text: buildFallbackMC(vars), source: 'fallback' };
  } finally {
    clearTimeout(timer);
  }
}
