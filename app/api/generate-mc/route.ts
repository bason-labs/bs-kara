import { NextRequest, NextResponse } from 'next/server';

// Persona is intentionally constrained: the TTS engine reads the result aloud
// verbatim, so any markdown, emoji, or quotes leak through as awkward speech.
const PERSONA =
  'Bạn là một MC quán karaoke cực kỳ duyên dáng, hài hước và nhiệt tình. Hãy giới thiệu bài hát tiếp theo, trêu đùa nhẹ nhàng, cổ vũ người hát. Trả lời cực kỳ ngắn gọn (tối đa 2-3 câu), nói bằng tiếng Việt văn xuôi tự nhiên để máy đọc (tuyệt đối không dùng emoji, hashtag, ký tự đặc biệt hay ngoặc kép).';

const FALLBACK_TEXT =
  'Xin mời quý vị cùng thưởng thức ca khúc tiếp theo ngay sau đây!';

const TIMEOUT_MS = 4000;

interface GenerateMCBody {
  songTitle?: unknown;
  singerName?: unknown;
}

function buildUserPrompt(songTitle: string, singerName: string | null): string {
  const trimmedSinger = singerName?.trim();
  if (trimmedSinger) {
    return `Bài hát tiếp theo có tên: ${songTitle}. Người trình bày: ${trimmedSinger}. Hãy giới thiệu thật duyên dáng.`;
  }
  return `Bài hát tiếp theo có tên: ${songTitle}. Hãy giới thiệu thật duyên dáng.`;
}

async function callOpenAI(
  songTitle: string,
  singerName: string | null,
  signal: AbortSignal,
): Promise<string> {
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
        { role: 'user', content: buildUserPrompt(songTitle, singerName) },
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

async function callGemini(
  songTitle: string,
  singerName: string | null,
  signal: AbortSignal,
): Promise<string> {
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
          parts: [{ text: buildUserPrompt(songTitle, singerName) }],
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
// not to emit them. Belt-and-suspenders against persona drift.
function sanitizeForTTS(text: string): string {
  return text
    .replace(/["'`*_~#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: NextRequest) {
  let body: GenerateMCBody = {};
  try {
    body = (await req.json()) as GenerateMCBody;
  } catch {
    // Malformed JSON — fall through to validation below.
  }

  const songTitle =
    typeof body.songTitle === 'string' ? body.songTitle.trim() : '';
  const singerName =
    typeof body.singerName === 'string' ? body.singerName : null;

  if (!songTitle) {
    return NextResponse.json({ text: FALLBACK_TEXT });
  }

  const provider = (process.env.AI_MC_PROVIDER ?? '').toLowerCase().trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let text: string;
    if (provider === 'openai') {
      text = await callOpenAI(songTitle, singerName, controller.signal);
    } else if (provider === 'gemini') {
      text = await callGemini(songTitle, singerName, controller.signal);
    } else {
      throw new Error(`Unsupported AI_MC_PROVIDER: "${provider}"`);
    }
    const cleaned = sanitizeForTTS(text);
    return NextResponse.json({ text: cleaned || FALLBACK_TEXT });
  } catch (err) {
    console.error('[generate-mc] falling back:', err);
    return NextResponse.json({ text: FALLBACK_TEXT });
  } finally {
    clearTimeout(timer);
  }
}
