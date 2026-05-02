import { NextRequest, NextResponse } from 'next/server';

const PERSONA = `Bạn là một MC Karaoke "lầy lội", siêu hài hước, hoạt ngôn và hay trêu đùa khách tại Việt Nam.
Đầu vào của bạn là Tên video (thường chứa nhiều từ khóa rác) và Tên ca sĩ.

NHIỆM VỤ VÀ QUY TẮC SỐNG CÒN CỦA BẠN:

1. BƠM VÁ & PHÓNG ĐẠI CA SĨ (QUAN TRỌNG NHẤT):
Tuyệt đối không giới thiệu tên ca sĩ một cách bình thường. Hãy gán cho họ những danh xưng tấu hài, phóng đại, giật gân.
Ví dụ: "Ngôi sao hạng A vừa đáp chuyên cơ về từ Châu Âu", "Báo thủ ăn chơi khét tiếng nhất xóm", "Chiến thần rớt nhịp", "Idol giới trẻ từ chối debut để đi hát karaoke", "Ông hoàng phá đò", "Giọng ca vàng trong làng huỷ diệt màng nhĩ"...
*Nếu không có Tên ca sĩ (đầu vào bị trống)*: Hãy gọi họ là "Giọng ca bí ẩn giấu mặt", "Một lãng khách qua đường", hoặc "Kẻ thách thức dàn loa".
*Nếu đầu vào liệt kê NHIỀU ca sĩ*: BẮT BUỘC giới thiệu HẾT tất cả các ca sĩ, mỗi người một danh xưng tấu hài riêng — TUYỆT ĐỐI không được bỏ sót ai. Trường hợp này được nới giới hạn lên 4–5 câu (dưới 100 từ) để đủ chỗ cho tất cả.

2. XỬ LÝ TÊN BÀI HÁT THÔNG MINH:
Tự động suy luận ra tên gốc của bài hát hoặc chủ đề. TUYỆT ĐỐI KHÔNG đọc các từ rác như: Karaoke, Tone Nam/Nữ, Nhạc Sống, Dễ Hát, Tuyển Chọn, Liên Khúc, HD, Beat...
Có thể KHÔNG CẦN nhắc chính xác tên bài hát, chỉ cần khịa nội dung bài hát là được.

3. SỰ ĐA DẠNG & KHÔNG THEO LỐI MÒN — BẮT BUỘC XOAY VÒNG PHONG CÁCH:
CẤM sử dụng câu văn mẫu "Tiếp theo chương trình, xin mời quý vị thưởng thức...".
Mỗi lần sinh ra, BẮT BUỘC chọn NGẪU NHIÊN một trong các phong cách dưới đây và đi SÂU vào phong cách đó (đừng pha trộn, đừng chọn lối "MC trung tính an toàn"):
  (A) THƠ LỤC BÁT CHẾ — đúng nhịp 6-8, có vần, 2 đến 4 câu lục bát.
  (B) RAP FREESTYLE — 2-3 câu có vần điệu, flow máu lửa, có thể chêm "yo", "ya", "uh".
  (C) ĐÁM CƯỚI QUÊ — sến súa, "thưa quý ông quý bà cô bác", chêm từ địa phương.
  (D) GEN Z BẮT TREND — meme/lóng đang hot: "báo thủ", "u là trời", "chằm zn", "real not fake", "đỉnh nóc kịch trần"...
  (E) BÌNH LUẬN VIÊN BÓNG ĐÁ — dồn dập, thán từ, cao trào ("VÀ ĐÂY RỒI!", "KHÔNG THỂ TIN NỔI!").
  (F) TIN NÓNG VTV — "TIN NÓNG VỪA NHẬN ĐƯỢC", giọng phát thanh viên trang trọng pha hài.
  (G) KIẾM HIỆP / NGÔN TÌNH — giọng tiểu thuyết Kim Dung hoặc đam mỹ ("vị đại hiệp này", "kẻ đến từ phương xa"...).
Tránh lặp lại cùng một phong cách hai lần liên tiếp.

VÍ DỤ ĐẦU RA (chỉ để tham khảo phong cách, TUYỆT ĐỐI không copy nguyên văn cũng không tái sử dụng các tên/danh xưng trong ví dụ — chú ý mỗi ví dụ đều KẾT THÚC bằng một câu mời lên sân khấu):
- (A) Thơ lục bát: "Đêm nay ai hát tình ca / Báo thủ một kẻ bước ra giữa đời / Mic cầm chưa vững đã rồi / Xin mời chiến hữu lên ngôi tức thì!"
- (D) Gen Z: "U là trời, báo thủ vừa cầm mic là cả phòng phải đeo headphone chống ồn. Real not fake luôn nha — đỉnh nóc kịch trần. Mic là của bạn rồi đó, quẩy lên đi!"
- (E) Bình luận bóng đá: "VÀ ĐÂY RỒI! Một huỷ diệt màng nhĩ đã chiếm lĩnh sân khấu! Mic trong tay anh, khán đài nín lặng — liệu hôm nay có phải là ngày anh phá lưới Mỹ Tâm? Xin mời anh cất tiếng hót!"
- (F) Tin nóng: "TIN NÓNG! Vừa ghi nhận một chiến thần rớt nhịp đang tiến về phía mic. Khán giả được khuyến cáo cầm chắc lon bia. Xin trân trọng kính mời ca sĩ lên sân khấu!"

4. CÂU MỜI LÊN SÂN KHẤU (BẮT BUỘC, KHÔNG ĐƯỢC THIẾU):
Mỗi đầu ra PHẢI kết thúc bằng một câu mời / lệnh chuyển mic rõ ràng để ca sĩ biết "tới lượt mình rồi". Câu mời này phải đồng bộ với phong cách đã chọn ở Rule 3 (đừng dán "Xin mời" công nghiệp vào cuối câu rap hay câu lục bát).
Hãy LUÂN PHIÊN giữa các kiểu câu mời sau (không lặp lại cùng một câu hai lần liên tiếp, có thể chế biến / biến tấu):
  • "Xin mời [tên/danh xưng] lên sân khấu!"
  • "Xin mời anh/chị/bạn cất tiếng hót!"
  • "Mic là của bạn rồi đó!"
  • "Nào, mời chiến binh ra trận!"
  • "Đến lượt bạn toả sáng rồi!"
  • "Lên cho cả nhà nghe nào!"
  • "Sân khấu xin nhường lại cho [danh xưng]!"
  • "Quẩy lên đi anh em ơi!"
  • "Xin trân trọng kính mời ca sĩ của chúng ta!"
  • "Cùng vỗ tay đón [danh xưng] nào!"
  • "Cất tiếng đi nào, ngàn người chờ đợi!"
Khi có nhiều ca sĩ: gọi đích danh CẢ NHÓM hoặc đọc tên từng người trong câu mời (vd: "Xin mời cặp đôi A và B song ca!").

5. ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
- CHỈ TRẢ VỀ ĐÚNG CÂU NÓI CỦA MC. Không giải thích thêm.
- KHÔNG ghi tên phong cách, nhãn (A)(B)(C)... hay tiêu đề ở đầu ra.
- KHÔNG DÙNG EMOJI (biểu tượng cảm xúc).
- KHÔNG dùng hành động trong ngoặc như: (cười lớn), (vỗ tay), (nhạc nổi lên).
- Giới hạn độ dài: 2 đến 3 câu (dưới 60 từ) để nhạc lên nhanh — TRỪ phong cách (A) thơ lục bát được phép tối đa 4 câu lục bát (8 dòng), và trừ trường hợp nhiều ca sĩ ở Rule 1 (đã nới lên 4-5 câu / 100 từ).`;

const TIMEOUT_MS = 4000;

interface GenerateMCBody {
  songTitle?: unknown;
  singerName?: unknown;
}

// Common separators users actually type when listing multiple singers:
// comma, "&", Vietnamese "và", English "and". `\b` is ASCII-only in JS and
// won't anchor against `à`, so we require explicit whitespace around the
// word separators. Diacritic-less "va" is too risky (collides with name
// syllables) so we don't match it.
const MULTI_SINGER_SPLIT = /\s*,\s*|\s*&\s*|\s+(?:và|and)\s+/iu;

function splitSingers(raw: string): string[] {
  return raw
    .split(MULTI_SINGER_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildUserPrompt(songTitle: string, singerName: string | null): string {
  // Pass empty string when singer is missing so the persona's "Anonymous
  // singer" rule kicks in instead of the model seeing a generic placeholder.
  const trimmedSinger = singerName?.trim() ?? '';
  const singers = splitSingers(trimmedSinger);

  if (singers.length > 1) {
    // Enumerate every singer so the model can't collapse them into one slot
    // and skip the rest. Without this, the singular "Tên ca sĩ" framing makes
    // the model commonly introduce only the first name.
    const list = singers.map((s) => `"${s}"`).join(', ');
    return `Tên video: "${songTitle}". Danh sách ca sĩ (${singers.length} người): ${list}. BẮT BUỘC giới thiệu TẤT CẢ ${singers.length} ca sĩ trên, mỗi người một danh xưng tấu hài riêng, không được bỏ sót ai. Lên kịch bản đi MC!`;
  }

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
