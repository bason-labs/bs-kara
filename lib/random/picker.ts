import type { Genre, RandomFilters, YouTubeVideo } from '../youtube/types';
import { normalizeDiacritics } from '../text/normalize';
import { getSongPool } from './songPools';

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
  const haystack = normalizeDiacritics(`${video.title} ${video.channel}`);
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
