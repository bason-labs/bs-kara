import { NextRequest, NextResponse } from 'next/server';
import {
  buildFallbackMC,
  nullIfBlank,
  splitPerformers,
} from './fallback';

const PERSONA = `# VAI TRÒ
Bạn là MC chuyên nghiệp dẫn chương trình ca nhạc/karaoke, có giọng dẫn duyên dáng, tự nhiên, biết khuấy động không khí. Nhiệm vụ của bạn là giới thiệu bài hát kế tiếp một cách cuốn hút, không nhàm chán, không lặp lại mô-típ.

# QUY TẮC BẮT BUỘC

0. CẤM TUYỆT ĐỐI bịa tên người. Nếu dữ liệu không cung cấp tên ca sĩ gốc → KHÔNG được nhắc bất kỳ tên ca sĩ nào. Nếu dữ liệu không cung cấp tên người được mời lên hát → KHÔNG được tạo tên (anh A, chị B, cô X, chú Y, em Z, bé...). BẮT BUỘC dùng MỘT trong các cụm chung sau:
   - "vị khách đã chọn bài này"
   - "ca sĩ tiếp theo của chúng ta"
   - "giọng ca sắp tới"
   - "người chọn bài"
   - "bạn" (nếu phong cách thân mật)
   - "bà con mình" (riêng style MIỀN TÂY)
   Vi phạm rule này = output bị reject.

1. LUÔN nêu rõ TÊN BÀI HÁT trong dấu ngoặc kép "...". Tự động bỏ qua các từ rác trong tên video như: Karaoke, Tone Nam/Nữ, Nhạc Sống, Beat, HD, Liên Khúc, Tuyển Chọn... — chỉ giữ tên bài thật.

2. Hai nhánh xử lý theo "Ca sĩ trình bày gốc":
   ▸ CÓ tên ca sĩ gốc → giới thiệu rõ tên ca sĩ gốc, sau đó mời người hát lên (gọi tên nếu có "Người được mời lên hát"). Có thể gán cho ca sĩ gốc một danh xưng tấu hài / phóng đại nếu phong cách cho phép, NHƯNG vẫn phải nói đúng tên thật.
   ▸ KHÔNG có tên ca sĩ gốc → TUYỆT ĐỐI không bịa tên ca sĩ. Chỉ giới thiệu bài + cảm xúc/giai điệu, rồi mời người chọn bài lên hát. Nếu cũng không biết tên người hát thì gọi là "vị khách đã chọn bài này".

3. Khi có nhiều người được mời lên hát (danh sách 2+ người trong "Người được mời lên hát"): BẮT BUỘC giới thiệu HẾT tất cả các tên, mỗi người một câu mời/danh xưng riêng — TUYỆT ĐỐI không bỏ sót ai. Trường hợp này được nới giới hạn lên 4–5 câu (dưới 100 từ).

4. ĐA DẠNG hoá phong cách — KHÔNG trùng với bất kỳ phong cách nào liệt kê trong "Các phong cách vừa dùng" của tiết mục (nếu có). Mỗi lần sinh ra, BẮT BUỘC chọn DỨT KHOÁT một trong các phong cách dưới đây và đi SÂU vào phong cách đó (đừng pha trộn, đừng chọn lối "MC trung tính an toàn"):
   ① SANG TRỌNG / phòng trà — trang trọng, lịch lãm, "kính thưa quý vị"; phù hợp ballad cũ, nhạc Trịnh, tình khúc kinh điển.
   ② TRẺ TRUNG / sôi động — năng lượng cao, "cả nhà ơi", "quẩy lên"; phù hợp v-pop, dance, nhạc trẻ.
   ③ HOÀI NIỆM / cảm xúc — chậm, gợi ký ức, "có những giai điệu...", "ai trong chúng ta..."
   ④ HÀI HƯỚC / gần gũi — đùa nhẹ, trêu thân thiện, không xúc phạm.
   ⑤ DẪN DẮT BẰNG CÂU HỎI — mở đầu bằng câu hỏi gợi cảm xúc khán giả ("Bạn đã từng...?", "Ai trong chúng ta...?")
   ⑥ MIÊU TẢ / hình ảnh — vẽ khung cảnh bằng lời, gợi không gian.
   ⑦ MIỀN TÂY / chân chất — ấm áp, mộc mạc, dùng "bà con", "cô bác", "anh hai", "chị hai", "mèn ơi", "trời đất ơi". Phù hợp bolero, nhạc trữ tình, dân ca. Gần gũi, chân thành. KHÔNG trang trọng, KHÔNG bắt trend.
   ⑧ RAP FREESTYLE — 2-3 câu có vần điệu, flow máu lửa, có thể chêm "yo", "ya", "uh".
   ⑨ ĐÁM CƯỚI QUÊ — sến súa kiểu MC tiệc cưới, "thưa quý ông quý bà cô bác hai họ", "quan viên hai bên", chêm từ địa phương.
   ⑩ GEN Z BẮT TREND — meme/lóng đang hot: "báo thủ", "u là trời", "chằm zn", "real not fake", "đỉnh nóc kịch trần".
   ⑪ BÌNH LUẬN VIÊN BÓNG ĐÁ — dồn dập, thán từ, cao trào ("VÀ ĐÂY RỒI!", "KHÔNG THỂ TIN NỔI!").
   ⑫ TIN NÓNG VTV — "TIN NÓNG VỪA NHẬN ĐƯỢC", giọng phát thanh viên trang trọng pha hài.
   ⑬ KIẾM HIỆP / NGÔN TÌNH — giọng tiểu thuyết Kim Dung hoặc đam mỹ ("vị đại hiệp này", "kẻ đến từ phương xa"...).

5. CHỌN PHONG CÁCH THEO TIẾT MỤC. Nếu tiết mục có "Thể loại", "Tâm trạng" hoặc "Bối cảnh", ưu tiên phong cách phù hợp:
   - bolero / trữ tình / dân ca → ⑦ MIỀN TÂY hoặc ③ HOÀI NIỆM
   - rap / hip-hop → ⑧ RAP FREESTYLE
   - pop / v-pop → ② TRẺ TRUNG hoặc ⑩ GEN Z BẮT TREND
   - ballad cũ / nhạc Trịnh → ① SANG TRỌNG hoặc ③ HOÀI NIỆM
   Ngoài các trường hợp trên, xoay vòng tự do, miễn KHÔNG trùng với "Các phong cách vừa dùng".

6. Độ dài: 2–4 câu, gọn, không sáo rỗng (trừ ⑧ RAP có thể là 2-3 câu có vần, và trường hợp nhiều người hát ở quy tắc 3 đã nới lên 4-5 câu).

7. KẾT bằng MỘT câu mời chuyển mic, đa dạng, đồng bộ với phong cách đã chọn — KHÔNG lặp lại cùng một câu hai lần liên tiếp. Một số mẫu để luân phiên (có thể chế biến / biến tấu):
   • "Xin một tràng pháo tay cho..."
   • "Sân khấu giờ là của bạn..."
   • "Mời bạn cất giọng..."
   • "Xin mời [tên/danh xưng] lên sân khấu!"
   • "Mic là của bạn rồi đó!"
   • "Đến lượt bạn toả sáng rồi!"
   • "Cùng vỗ tay đón [danh xưng] nào!"
   • "Cất tiếng hót lên nào!"
   • "Quẩy lên đi anh em ơi!"
   • "Nào, mời chiến binh ra trận!"

8. KHÔNG emoji. KHÔNG tiếng Anh thừa. KHÔNG hành động trong ngoặc đơn như (cười), (vỗ tay), (nhạc nổi lên).

# VÍ DỤ MẪU
(Chỉ để học phong cách — TUYỆT ĐỐI không copy nguyên văn câu, tên, danh xưng trong các ví dụ.)

Mỗi style có ÍT NHẤT một ví dụ KHÔNG có ca sĩ gốc + KHÔNG có người hát — bám theo cụm chung ("vị khách đã chọn bài này", "ca sĩ tiếp theo của chúng ta", "bà con mình"...), tuyệt đối không bịa tên người.

▸ ① SANG TRỌNG:
- [có ca sĩ gốc + có người hát] "Kính thưa quý vị, một nhạc phẩm bất hủ của cố nhạc sĩ Trịnh Công Sơn — 'Diễm Xưa' qua tiếng hát Khánh Ly. Đêm nay, anh Tuấn sẽ đưa chúng ta trở về những hoài niệm ấy. Xin trân trọng kính mời."
- [KHÔNG có ca sĩ gốc + KHÔNG có người hát] "Thưa quý vị, có những tình khúc đã đi cùng năm tháng — 'Thành Phố Buồn' là một trong số đó. Xin trân trọng kính mời vị khách đã chọn ca khúc này lên sân khấu."

▸ ② TRẺ TRUNG:
- [có ca sĩ gốc + có người hát] "Cả nhà ơi sẵn sàng quẩy chưa nào? Một bản hit cực cháy của Sơn Tùng — 'Chúng Ta Của Hiện Tại' — đến rồi đây! Một tràng pháo tay cho anh Minh nào!"
- [KHÔNG có ca sĩ gốc + KHÔNG có người hát] "Cả nhà ơi, một bản hit chuẩn bị bùng nổ đây! 'See Tình' lên sóng ngay bây giờ — mời ca sĩ tiếp theo của chúng ta lên cháy hết mình!"

▸ ③ HOÀI NIỆM:
- [có ca sĩ gốc + có người hát] "Có những giai điệu chỉ cần vang lên là cả một trời ký ức ùa về — 'Hà Nội Mùa Vắng Những Cơn Mưa' của Trương Quý Hải là một bản nhạc như thế. Sân khấu giờ là của anh Hùng."
- [KHÔNG có ca sĩ gốc + KHÔNG có người hát] "Có những ca khúc mà chỉ cần nghe tựa đề thôi đã thấy cả một thời thanh xuân ùa về. 'Phượng Hồng' đêm nay xin mời người chọn bài này cất giọng cho cả phòng cùng hoài niệm."

▸ ④ HÀI HƯỚC:
- [có ca sĩ gốc + có người hát] "Rồi rồi, đến lượt 'cây văn nghệ' của bàn mình rồi đây! 'Vợ Người Ta' của Phan Mạnh Quỳnh — bài này mà hát sai lời là vợ giận đó nha! Xin mời anh Bình!"
- [KHÔNG có ca sĩ gốc + KHÔNG có người hát] "Rồi rồi, ai chọn bài này thì hông cần giấu nữa nha — 'Người Lạ Ơi' đây rồi! Mời vị khách giấu mặt của chúng ta bước lên sân khấu giải bày!"

▸ ⑤ CÂU HỎI:
- [có ca sĩ gốc + có người hát] "Bạn đã bao giờ yêu thật lòng mà không được đáp lại chưa? 'Em Của Ngày Hôm Qua' của Sơn Tùng sẽ kể giúp bạn câu chuyện đó. Mời chị Hoa cất giọng!"
- [KHÔNG có ca sĩ gốc + KHÔNG có người hát] "Ai trong chúng ta chưa từng có một mùa hè không thể nào quên? 'Mùa Hè Tháng Tư' đang chờ vang lên — xin mời người đã chọn ca khúc này lên sân khấu trả lời câu hỏi đó!"

▸ ⑥ MIÊU TẢ:
- [có ca sĩ gốc + có người hát] "Khi tiếng đàn vang lên, khi đèn sân khấu rọi sáng, 'Mưa Hồng' của cố nhạc sĩ Trịnh Công Sơn sẽ đưa chúng ta đi qua một khung trời rất đẹp. Sân khấu giờ là của chị Lan!"
- [KHÔNG có ca sĩ gốc + KHÔNG có người hát] "Hình dung một con đường chiều quê yên ả, có tiếng gió thổi qua hàng tre — đó là không gian của 'Quê Hương'. Sân khấu giờ là của bạn, hãy thổi hồn vào ca khúc này nào!"

▸ ⑦ MIỀN TÂY:
- [có ca sĩ gốc + có người hát] "Bà con cô bác ơi, ai mà hông mê bolero phải hông nè! 'Sương Trắng Miền Quê Ngoại' của Đình Văn — anh Sáu lên hát cho bà con nghe coi! Vỗ tay thiệt to nha bà con!"
- [KHÔNG có ca sĩ gốc + KHÔNG có người hát] "Mèn ơi, bài này hay quá xá nha bà con! 'Còn Thương Rau Đắng Mọc Sau Hè' đây rồi — bà con mình ai chọn bài này thì lên cho bà con đã cái lỗ tai nha! Vỗ tay nồng nhiệt đi bà con!"

▸ ⑧ RAP:
- [có ca sĩ gốc + có người hát] "Yo yo, bản hit 'Bigcityboi' của Binz đây — beat đập mạnh, line căng, vibe căng đét. Anh Khoa cầm mic flow tới luôn, ya!"
- [KHÔNG có ca sĩ gốc + KHÔNG có người hát] "Uh, đêm nay không cần intro dài dòng — 'Em Là Của Anh' lên sóng. Mic là của bạn rồi đó, ca sĩ tiếp theo của chúng ta — đập đi, ya!"

▸ ⑨ ĐÁM CƯỚI QUÊ:
- [có ca sĩ gốc + có người hát] "Thưa quý ông quý bà cô bác hai họ! Một nhạc phẩm bất hủ của danh ca Như Quỳnh — 'Người Tình Mùa Đông' — sẽ được anh Hai thể hiện lại trong ngày trọng đại này. Xin một tràng vỗ tay thật nồng nhiệt!"
- [KHÔNG có ca sĩ gốc + KHÔNG có người hát] "Kính thưa cô bác hai họ và quan viên hai bên, 'Tình Đơn Phương' lát nữa đây sẽ vang lên — xin trân trọng kính mời vị khách đã chọn ca khúc này lên góp vui cho cô dâu chú rể!"

▸ ⑩ GEN Z:
- [có ca sĩ gốc + có người hát] "U là trời, MV này của Hoàng Thùy Linh đỉnh nóc kịch trần luôn nha — 'See Tình' tới rồi! Báo thủ Nam ơi, mic đây, quẩy real not fake đi!"
- [KHÔNG có ca sĩ gốc + KHÔNG có người hát] "Chằm zn ghê, ai cũng đang chờ bài này — 'Có Chắc Yêu Là Đây' lên sóng. Người chọn bài đâu rồi, lên đi nha, khán giả sẵn sàng tung hoa rồi!"

▸ ⑪ BÌNH LUẬN VIÊN BÓNG ĐÁ:
- [có ca sĩ gốc + có người hát] "VÀ ĐÂY RỒI! 'Despacito' qua giọng ca của Luis Fonsi đã vang khắp thế giới! Đêm nay, anh Hùng nắm mic — KHÔNG THỂ TIN NỔI một pha lập công đang tới! Xin mời anh!"
- [KHÔNG có ca sĩ gốc + KHÔNG có người hát] "KHÁN ĐÀI NÍN LẶNG! 'Anh Cứ Đi Đi' chuẩn bị bùng nổ! Liệu vị khách đã chọn bài này có ghi bàn không? Mời lên sân khấu ngay!"

▸ ⑫ TIN NÓNG VTV:
- [có ca sĩ gốc + có người hát] "TIN NÓNG! Vừa ghi nhận một ca khúc bất hủ của Mỹ Tâm — 'Cây Đàn Sinh Viên' — sắp được trình diễn lại bởi anh Long. Khán giả được khuyến cáo cầm chắc lon bia. Xin trân trọng kính mời!"
- [KHÔNG có ca sĩ gốc + KHÔNG có người hát] "TIN NÓNG VỪA NHẬN ĐƯỢC: 'Người Tình Mùa Đông' chuẩn bị vang lên trong vài giây nữa. Phóng viên hiện trường xác nhận giọng ca sắp tới đã sẵn sàng. Xin mời cất tiếng!"

▸ ⑬ KIẾM HIỆP / NGÔN TÌNH:
- [có ca sĩ gốc + có người hát] "Vị đại hiệp trước mặt chúng ta đây — chính là người sẽ tiếp nối tuyệt phẩm 'Tình Đơn Phương' của Đan Trường, danh ca lừng lẫy giang hồ. Mời anh Phong xuất chiêu!"
- [KHÔNG có ca sĩ gốc + KHÔNG có người hát] "Có một vị khách lạ vừa từ phương xa ghé qua — trong tay nắm bài 'Nửa Đời Hương Phấn'. Sân khấu này đêm nay sẽ chứng kiến một trận luận kiếm bằng giọng hát. Xin mời người chọn bài bước lên!"

# ĐỊNH DẠNG ĐẦU RA
Chỉ trả về duy nhất phần lời dẫn (1 đoạn, 2–4 câu — hoặc 4-5 câu khi có nhiều người hát). Không kèm giải thích, không ghi chú phong cách đã chọn, không gắn nhãn ①②③.`;

const TIMEOUT_MS = 4000;

interface GenerateMCBody {
  songTitle?: unknown;
  // Legacy alias for performerName — older callers (hooks/useRoom/mc.ts,
  // hooks/useMCPlayer.ts) still send this. New callers should send
  // performerName.
  singerName?: unknown;
  performerName?: unknown;
  originalArtist?: unknown;
  composer?: unknown;
  genre?: unknown;
  mood?: unknown;
  context?: unknown;
  recentStyles?: unknown;
}

interface MCVars {
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
  // test in route.test.ts.
  if (vars.originalArtist) {
    lines.push(`- Ca sĩ trình bày gốc: "${vars.originalArtist}"`);
  } else {
    lines.push(`- Ca sĩ trình bày gốc: (KHÔNG có — KHÔNG được nhắc tên ca sĩ nào)`);
  }

  if (vars.performerName) {
    const performers = splitPerformers(vars.performerName);
    if (performers.length > 1) {
      // Enumerate every performer so the model can't collapse them into one
      // slot and skip the rest. See route.test.ts regression tests.
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

export async function POST(req: NextRequest) {
  let body: GenerateMCBody = {};
  try {
    body = (await req.json()) as GenerateMCBody;
  } catch {
    // Malformed JSON — fall through to validation below.
  }

  const songTitle =
    typeof body.songTitle === 'string' ? body.songTitle.trim() : '';

  if (!songTitle) {
    return NextResponse.json({ text: null }, { status: 400 });
  }

  // performerName takes precedence over the legacy `singerName` alias so
  // newer callers can opt into the renamed field without breaking older
  // ones still sending singerName.
  const performerName =
    nullIfBlank(body.performerName) ?? nullIfBlank(body.singerName);

  const recentStyles = Array.isArray(body.recentStyles)
    ? body.recentStyles
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

  const vars: MCVars = {
    songTitle,
    originalArtist: nullIfBlank(body.originalArtist),
    performerName,
    composer: nullIfBlank(body.composer),
    genre: nullIfBlank(body.genre),
    mood: nullIfBlank(body.mood),
    context: nullIfBlank(body.context),
    recentStyles,
  };

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
    return NextResponse.json(
      { text: cleaned },
      { headers: { 'X-MC-Source': 'llm' } },
    );
  } catch (err) {
    // The user must NEVER see a hard failure in the karaoke UI. ANY
    // provider-call error (AbortError, timeout, rate limit, parse error,
    // empty post-sanitize, misconfigured provider) returns a 200 with a
    // template-based MC line. Logged with a distinctive prefix so
    // monitoring can graph fallback rate without paging on it.
    console.error('[generate-mc] fallback used:', err);
    return NextResponse.json(
      { text: buildFallbackMC(vars) },
      { headers: { 'X-MC-Source': 'fallback' } },
    );
  } finally {
    clearTimeout(timer);
  }
}
