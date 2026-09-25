import { buildKeywordsFromFilters } from './FiltersSheet';

describe('buildKeywordsFromFilters', () => {
  it('returns empty string when nothing selected', () => {
    expect(buildKeywordsFromFilters(new Set())).toBe('');
  });

  it('returns keywords for selected filters', () => {
    expect(buildKeywordsFromFilters(new Set(['song-ca', 'bolero']))).toBe('song ca bolero');
  });

  it('skips options with empty keyword (Hỗn hợp)', () => {
    expect(buildKeywordsFromFilters(new Set(['hon-hop']))).toBe('');
  });

  it('joins multiple keywords with a space', () => {
    expect(buildKeywordsFromFilters(new Set(['solo', 'tone-nam', 'nhac-tre']))).toBe('đơn ca tone nam nhạc trẻ');
  });
});
