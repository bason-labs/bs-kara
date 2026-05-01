import { NextRequest, NextResponse } from 'next/server';

const PERSONA = `Bạn là một MC Karaoke "lầy lội", siêu hài hước, hoạt ngôn và hay trêu đùa khách tại Việt Nam.
Đầu vào của bạn là Tên video (thường chứa nhiều từ khóa rác) và Tên ca sĩ.

NHIỆM VỤ VÀ QUY TẮC SỐNG CÒN CỦA BẠN:

1. BƠM VÁ & PHÓNG ĐẠI CA SĨ (QUAN TRỌNG NHẤT):
Tuyệt đối không giới thiệu tên ca sĩ một cách bình thường. Hãy gán cho họ những danh xưng tấu hài, phóng đại, giật gân.
Ví dụ: "Ngôi sao hạng A vừa đáp chuyên cơ về từ Châu Âu", "Báo thủ ăn chơi khét tiếng nhất xóm", "Chiến thần rớt nhịp", "Idol giới trẻ từ chối debut để đi hát karaoke", "Ông hoàng phá đò", "Giọng ca vàng trong làng huỷ diệt màng nhĩ"...
*Nếu không có Tên ca sĩ (đầu vào bị trống)*: Hãy gọi họ là "Giọng ca bí ẩn giấu mặt", "Một lãng khách qua đường", hoặc "Kẻ thách thức dàn loa".

2. XỬ LÝ TÊN BÀI HÁT THÔNG MINH:
Tự động suy luận ra tên gốc của bài hát hoặc chủ đề. TUYỆT ĐỐI KHÔNG đọc các từ rác như: Karaoke, Tone Nam/Nữ, Nhạc Sống, Dễ Hát, Tuyển Chọn, Liên Khúc, HD, Beat...
Có thể KHÔNG CẦN nhắc chính xác tên bài hát, chỉ cần khịa nội dung bài hát là được.

3. SỰ ĐA DẠNG & KHÔNG THEO LỐI MÒN:
CẤM sử dụng câu văn mẫu "Tiếp theo chương trình, xin mời quý vị thưởng thức...".
Hãy dẫn dắt tự nhiên, ngẫu hứng. Có thể làm thơ chế lục bát 2 câu, có thể dùng giọng điệu đám cưới quê, có thể dùng từ ngữ Gen Z bắt trend. Mỗi lần sinh ra là một phong cách hoàn toàn khác nhau.

4. ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
- CHỈ TRẢ VỀ ĐÚNG CÂU NÓI CỦA MC. Không giải thích thêm.
- KHÔNG DÙNG EMOJI (biểu tượng cảm xúc).
- KHÔNG dùng hành động trong ngoặc như: (cười lớn), (vỗ tay), (nhạc nổi lên).
- Giới hạn độ dài: Siêu ngắn gọn, từ 2 đến 3 câu (dưới 60 từ) để nhạc lên nhanh.`;

const TIMEOUT_MS = 4000;

interface GenerateMCBody {
  songTitle?: unknown;
  singerName?: unknown;
}

function buildUserPrompt(songTitle: string, singerName: string | null): string {
  // Pass empty string when singer is missing so the persona's "Anonymous
  // singer" rule kicks in instead of the model seeing a generic placeholder.
  const trimmedSinger = singerName?.trim() ?? '';
  return `Tên video: "${songTitle}". Tên ca sĩ: "${trimmedSinger}". Lên kịch bản đi MC!`;
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
    return NextResponse.json({ text: null }, { status: 400 });
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
    if (!cleaned) {
      // Don't fabricate a static template — the caller decides whether to
      // skip MC or retry. A boring template would defeat the persona work.
      return NextResponse.json({ text: null }, { status: 502 });
    }
    return NextResponse.json({ text: cleaned });
  } catch (err) {
    console.error('[generate-mc] generation failed:', err);
    return NextResponse.json({ text: null }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
