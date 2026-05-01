import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BOLERO_SONGS,
  CA_CO_SONGS,
  POPULAR_KARAOKE_SONGS,
  buildRandomSearchQuery,
  getSongPool,
  pickBestVideo,
  pickRandomTitle,
  scoreVideoAgainstFilters,
} from './constants';
import type { RandomFilters, YouTubeVideo } from './youtube';

const baseFilters: RandomFilters = { type: 'all', tone: 'all', genre: 'all' };

function video(over: Partial<YouTubeVideo> = {}): YouTubeVideo {
  return {
    id: over.id ?? 'v',
    title: over.title ?? 'Untitled',
    channel: over.channel ?? 'Channel',
    thumbnail: over.thumbnail ?? '',
    duration: over.duration ?? '',
    ...over,
  };
}

describe('getSongPool', () => {
  it('returns bolero pool for bolero genre', () => {
    expect(getSongPool('bolero')).toBe(BOLERO_SONGS);
  });

  it('returns ca co pool for caco genre', () => {
    expect(getSongPool('caco')).toBe(CA_CO_SONGS);
  });

  it('returns popular pool for tre genre', () => {
    expect(getSongPool('tre')).toBe(POPULAR_KARAOKE_SONGS);
  });

  it('merges every pool for all genre', () => {
    const all = getSongPool('all');
    expect(all.length).toBe(
      POPULAR_KARAOKE_SONGS.length + BOLERO_SONGS.length + CA_CO_SONGS.length,
    );
    expect(all).toEqual(
      expect.arrayContaining([
        POPULAR_KARAOKE_SONGS[0],
        BOLERO_SONGS[0],
        CA_CO_SONGS[0],
      ]),
    );
  });
});

describe('buildRandomSearchQuery', () => {
  it('returns the bare title when no filters are active', () => {
    expect(buildRandomSearchQuery('Lệ Lưu Ly', baseFilters)).toBe('Lệ Lưu Ly');
  });

  it('appends song ca for duet type', () => {
    expect(buildRandomSearchQuery('X', { ...baseFilters, type: 'duet' })).toBe(
      'X song ca',
    );
  });

  it('appends đơn ca for solo type', () => {
    expect(buildRandomSearchQuery('X', { ...baseFilters, type: 'solo' })).toBe(
      'X đơn ca',
    );
  });

  it('appends tone keyword for male/female', () => {
    expect(buildRandomSearchQuery('X', { ...baseFilters, tone: 'male' })).toBe(
      'X tone nam',
    );
    expect(buildRandomSearchQuery('X', { ...baseFilters, tone: 'female' })).toBe(
      'X tone nữ',
    );
  });

  it('appends a genre keyword for bolero/caco/tre', () => {
    expect(buildRandomSearchQuery('X', { ...baseFilters, genre: 'bolero' })).toBe(
      'X bolero',
    );
    expect(buildRandomSearchQuery('X', { ...baseFilters, genre: 'caco' })).toBe(
      'X ca cổ',
    );
    expect(buildRandomSearchQuery('X', { ...baseFilters, genre: 'tre' })).toBe(
      'X nhạc trẻ',
    );
  });

  it('combines every active filter in title-then-keywords order', () => {
    expect(
      buildRandomSearchQuery('X', { type: 'duet', tone: 'female', genre: 'bolero' }),
    ).toBe('X song ca tone nữ bolero');
  });
});

describe('pickRandomTitle', () => {
  afterEach(() => vi.restoreAllMocks());

  it('skips titles already in triedTitles', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // pick first available
    const tried = new Set<string>([POPULAR_KARAOKE_SONGS[0]]);
    const picked = pickRandomTitle(tried, 'tre');
    expect(picked).toBe(POPULAR_KARAOKE_SONGS[1]);
  });

  it('falls back to the full pool when every title has been tried', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const tried = new Set(POPULAR_KARAOKE_SONGS);
    const picked = pickRandomTitle(tried, 'tre');
    expect(POPULAR_KARAOKE_SONGS).toContain(picked);
  });

  it('respects the genre filter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickRandomTitle(new Set(), 'bolero')).toBe(BOLERO_SONGS[0]);
    expect(pickRandomTitle(new Set(), 'caco')).toBe(CA_CO_SONGS[0]);
  });

  it('defaults to genre=all when omitted', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickRandomTitle(new Set())).toBe(POPULAR_KARAOKE_SONGS[0]);
  });
});

describe('scoreVideoAgainstFilters', () => {
  it('returns 0 with no active filters', () => {
    expect(scoreVideoAgainstFilters(video({ title: 'whatever' }), baseFilters)).toBe(0);
  });

  it('rewards duet keyword matches in title', () => {
    const score = scoreVideoAgainstFilters(
      video({ title: 'Bài Hát SONG CA hay' }),
      { ...baseFilters, type: 'duet' },
    );
    expect(score).toBeGreaterThan(0);
  });

  it('penalizes duet filter when no duet keywords are present', () => {
    const score = scoreVideoAgainstFilters(video({ title: 'Solo time' }), {
      ...baseFilters,
      type: 'duet',
    });
    expect(score).toBeLessThan(0);
  });

  it('penalizes solo filter when title looks like a duet', () => {
    const score = scoreVideoAgainstFilters(
      video({ title: 'Song Ca tuyệt phẩm' }),
      { ...baseFilters, type: 'solo' },
    );
    expect(score).toBeLessThan(0);
  });

  it('rewards solo filter when no duet keywords appear', () => {
    const score = scoreVideoAgainstFilters(
      video({ title: 'Một mình thôi' }),
      { ...baseFilters, type: 'solo' },
    );
    expect(score).toBeGreaterThan(0);
  });

  it('rewards tone match through diacritic-stripped comparison', () => {
    // "Tone Nữ" normalizes to "tone nu" which is in TONE_KEYWORDS.female
    const score = scoreVideoAgainstFilters(video({ title: 'Beat Tone Nữ chuẩn' }), {
      ...baseFilters,
      tone: 'female',
    });
    expect(score).toBeGreaterThanOrEqual(2);
  });

  it('rewards genre match in channel name too', () => {
    const score = scoreVideoAgainstFilters(
      video({ title: 'Bài cũ', channel: 'Bolero Trữ Tình Channel' }),
      { ...baseFilters, genre: 'bolero' },
    );
    expect(score).toBeGreaterThanOrEqual(2);
  });
});

describe('pickBestVideo', () => {
  it('returns the API order with no active filters', () => {
    const a = video({ id: 'a' });
    const b = video({ id: 'b' });
    expect(pickBestVideo([a, b], baseFilters, new Set())).toBe(a);
  });

  it('excludes videos whose id is in excludedIds', () => {
    const a = video({ id: 'a' });
    const b = video({ id: 'b' });
    expect(pickBestVideo([a, b], baseFilters, new Set(['a']))).toBe(b);
  });

  it('returns null when every candidate is excluded', () => {
    const a = video({ id: 'a' });
    expect(pickBestVideo([a], baseFilters, new Set(['a']))).toBeNull();
  });

  it('ranks duet matches above non-matches', () => {
    const plain = video({ id: 'plain', title: 'plain' });
    const duet = video({ id: 'duet', title: 'song ca duo' });
    const winner = pickBestVideo([plain, duet], { ...baseFilters, type: 'duet' }, new Set());
    expect(winner?.id).toBe('duet');
  });

  it('preserves API order for tied scores', () => {
    const a = video({ id: 'a', title: 'song ca' });
    const b = video({ id: 'b', title: 'song ca' });
    const winner = pickBestVideo([a, b], { ...baseFilters, type: 'duet' }, new Set());
    expect(winner?.id).toBe('a');
  });
});
