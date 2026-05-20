// Strips Vietnamese diacritics so "Tone Nữ" matches "tone nu". Used by the
// random-picker filter matcher and as the base step for the BFF search-cache
// key normaliser. Callers that also need whitespace canonicalisation (e.g.
// cache keys) should apply it themselves on top of this.
export function normalizeDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
