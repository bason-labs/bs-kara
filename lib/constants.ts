import type { Genre, RandomFilters, YouTubeVideo } from './youtube';

// Curated pools per Vietnamese karaoke genre. The auto-random picker
// chooses a pool based on the active `genre` filter and combines the
// title with type/tone keywords to build a YouTube search query.
// `POPULAR_KARAOKE_SONGS` doubles as the "Nhạc trẻ" (modern pop) pool.
export const POPULAR_KARAOKE_SONGS: string[] = [
  'Lệ Lưu Ly',
  'Cắt Đôi Nỗi Sầu',
  'Nơi Tình Yêu Bắt Đầu',
  'Lạc Trôi',
  'Vợ Người Ta',
  'Em Của Ngày Hôm Qua',
  'Người Lạ Ơi',
  'Buồn Của Anh',
  'Sóng Gió',
  'Hồng Nhan',
  'Bạc Phận',
  'Duyên Âm',
  'Chạy Ngay Đi',
  'Đừng Như Thói Quen',
  'Ai Chung Tình Được Mãi',
  'Sài Gòn Đau Lòng Quá',
  'Có Chàng Trai Viết Lên Cây',
  'Nắng Ấm Xa Dần',
  'Con Bướm Xuân',
  'Vì Anh Thương Em',
  'Vì Yêu Mà Đến',
  'Người Hãy Quên Em Đi',
  'Anh Cứ Đi Đi',
  'Phía Sau Một Cô Gái',
  'Nắm',
  'Ghen',
  'Em Gái Mưa',
  'Đi Để Trở Về',
  'Nơi Này Có Anh',
  'Thằng Hầu',
  'Hoa Nở Không Màu',
  'Sau Tất Cả',
  'Yêu Một Người Vô Tâm',
  'Để Cho Em Khóc',
  'Mình Yêu Nhau Đi',
  'Thê Lương',
  'Đường Tôi Chở Em Về',
  'Tình Bạn Diệu Kỳ',
  'Đừng Hỏi Em',
  'Một Bước Yêu Vạn Dặm Đau',
  'Đếm Ngày Xa Em',
  'Giá Như Em Là',
  'Anh Thanh Niên',
  'Gặp May',
  'Hai Triệu Năm',
  'Thương Em Là Điều Anh Không Thể Ngờ',
  'Buông Đôi Tay Nhau Ra',
  'Yêu Là Cưới',
  'Bống Bống Bang Bang',
];

// Bolero / nhạc trữ tình classics. Many uploaders explicitly tag titles
// with "Bolero" so adding it to the search query reinforces the genre.
export const BOLERO_SONGS: string[] = [
  'Đắp Mộ Cuộc Tình',
  'Sương Lạnh Chiều Đông',
  'Vùng Lá Me Bay',
  'Hoa Sứ Nhà Nàng',
  'Phố Đêm',
  'Đêm Buồn Tỉnh Lẻ',
  'Sầu Tím Thiệp Hồng',
  'Chuyến Tàu Hoàng Hôn',
  'Nỗi Buồn Hoa Phượng',
  'Định Mệnh',
  'Áo Cưới Màu Hoa Cà',
  'Lan Và Điệp',
  'Thành Phố Buồn',
  'Đoạn Buồn Đêm Mưa',
  'Tâm Sự Đời Tôi',
  'Mưa Chiều Kỷ Niệm',
  'Tình Lỡ',
  'Hoa Trinh Nữ',
  'Đêm Tâm Sự',
  'Vọng Cổ Buồn',
  'Đêm Lang Thang',
  'Căn Nhà Màu Tím',
];

// Vọng cổ / cải lương — traditional southern Vietnamese theatrical music.
// These titles surface ca cổ uploads reliably when paired with "ca cổ" or
// "vọng cổ" in the query.
export const CA_CO_SONGS: string[] = [
  'Tình Anh Bán Chiếu',
  'Võ Đông Sơ Bạch Thu Hà',
  'Mưa Rừng',
  'Nửa Đời Hương Phấn',
  'Đêm Lạnh Chùa Hoang',
  'Tô Ánh Nguyệt',
  'Áo Tình Đắp Mộ Người Yêu',
  'Lương Sơn Bá Chúc Anh Đài',
  'Trọng Thuỷ Mỵ Châu',
  'Lá Trầu Xanh',
  'Sầu Vương Ý Nhạc',
  'Người Yêu Cô Đơn',
  'Tâm Sự Loài Chim Biển',
  'Sương Trắng Miền Quê Ngoại',
  'Chiếc Áo Bà Ba',
];

// Returns the pool to draw random titles from, based on the active genre
// filter. "All" merges every genre so the auto-picker explores broadly.
export function getSongPool(genre: Genre): string[] {
  switch (genre) {
    case 'bolero':
      return BOLERO_SONGS;
    case 'caco':
      return CA_CO_SONGS;
    case 'tre':
      return POPULAR_KARAOKE_SONGS;
    case 'all':
    default:
      return [...POPULAR_KARAOKE_SONGS, ...BOLERO_SONGS, ...CA_CO_SONGS];
  }
}

// Translates filter selections into Vietnamese search keywords. The BFF
// already appends " karaoke beat" to every query, so we don't add another
// "karaoke" here — duplicate terms hurt YouTube's relevance ranking. The
// returned string is just the title plus any active filter keywords.
export function buildRandomSearchQuery(
  title: string,
  filters: RandomFilters,
): string {
  const parts: string[] = [title];
  if (filters.type === 'duet') parts.push('song ca');
  else if (filters.type === 'solo') parts.push('đơn ca');
  if (filters.tone === 'male') parts.push('tone nam');
  else if (filters.tone === 'female') parts.push('tone nữ');
  if (filters.genre === 'bolero') parts.push('bolero');
  else if (filters.genre === 'caco') parts.push('ca cổ');
  else if (filters.genre === 'tre') parts.push('nhạc trẻ');
  return parts.join(' ');
}

// Picks a random title from the genre pool, optionally skipping a set of
// titles already attempted. When all titles in the pool have been tried,
// returns any title from the pool (better to repeat than to silently stop
// the party).
export function pickRandomTitle(
  triedTitles: Set<string>,
  genre: Genre = 'all',
): string {
  const pool = getSongPool(genre);
  const available = pool.filter((s) => !triedTitles.has(s));
  const final = available.length > 0 ? available : pool;
  return final[Math.floor(Math.random() * final.length)];
}

// Strips Vietnamese diacritics so "Tone Nữ" matches "tone nu". Used by both
// the filter matcher and any caller that needs a loose, case-insensitive
// comparison against YouTube titles (which may or may not include marks).
function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Common Vietnamese title keywords that signal each filter condition. Many
// karaoke uploaders use varied phrasing — we accept any of these as a match.
const TYPE_KEYWORDS: Record<RandomFilters['type'], string[]> = {
  all: [],
  // Solo tags are rare in titles, so we mainly *avoid* duet keywords —
  // see scoreVideoAgainstFilters below.
  solo: ['don ca', 'solo'],
  duet: ['song ca', 'song-ca', 'duet', 'doi ca', 'nam nu'],
};

// Keep these specific — bare "nam"/"nu" would false-match too many titles.
const TONE_KEYWORDS: Record<RandomFilters['tone'], string[]> = {
  all: [],
  male: ['tone nam', 'beat nam', 'giong nam'],
  female: ['tone nu', 'beat nu', 'giong nu'],
};

// Genre keywords from common YouTube karaoke title conventions. "tru tinh"
// is the diacritic-stripped form of "trữ tình" (a synonym for bolero).
const GENRE_KEYWORDS: Record<RandomFilters['genre'], string[]> = {
  all: [],
  bolero: ['bolero', 'tru tinh'],
  caco: ['ca co', 'vong co', 'cai luong'],
  tre: ['nhac tre', 'pop', 'remix'],
};

// Returns a "match score" for a video against the requested filters: higher
// is better. Used to rank a batch of search results so we can pick a video
// that actually looks like a duet/male-tone/etc. when one is available.
export function scoreVideoAgainstFilters(
  video: YouTubeVideo,
  filters: RandomFilters,
): number {
  const haystack = normalizeText(`${video.title} ${video.channel}`);
  let score = 0;

  if (filters.type !== 'all') {
    const wanted = TYPE_KEYWORDS[filters.type];
    const hasWanted = wanted.some((k) => haystack.includes(k));
    if (filters.type === 'duet') {
      // "Song ca" is a strong, almost-always-titled signal — reward heavily.
      // Penalize titles that look explicitly solo so we don't mis-pick.
      if (hasWanted) score += 3;
      else score -= 1;
    } else if (filters.type === 'solo') {
      // For solo, prefer videos that DON'T look like duets.
      const looksDuet = TYPE_KEYWORDS.duet.some((k) => haystack.includes(k));
      if (looksDuet) score -= 2;
      else score += 1;
    }
  }

  if (filters.tone !== 'all') {
    const wanted = TONE_KEYWORDS[filters.tone];
    if (wanted.some((k) => haystack.includes(k))) score += 2;
  }

  if (filters.genre !== 'all') {
    const wanted = GENRE_KEYWORDS[filters.genre];
    if (wanted.some((k) => haystack.includes(k))) score += 2;
  }

  return score;
}

// Pick the best-scored video from a batch, skipping any whose ID is already
// in `excludedIds`. When several videos tie, we keep the API's relevance
// order (Array.sort is stable). Returns null when every result is excluded.
export function pickBestVideo(
  videos: YouTubeVideo[],
  filters: RandomFilters,
  excludedIds: Set<string>,
): YouTubeVideo | null {
  const candidates = videos.filter((v) => !excludedIds.has(v.id));
  if (candidates.length === 0) return null;

  // No active filters → keep the API's first non-excluded result.
  if (
    filters.type === 'all' &&
    filters.tone === 'all' &&
    filters.genre === 'all'
  ) {
    return candidates[0];
  }

  const ranked = candidates
    .map((v, i) => ({ v, i, score: scoreVideoAgainstFilters(v, filters) }))
    .sort((a, b) => (b.score - a.score) || (a.i - b.i));
  return ranked[0].v;
}
