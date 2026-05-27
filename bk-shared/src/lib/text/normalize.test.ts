import { describe, expect, it } from 'vitest';
import { normalizeDiacritics } from './normalize';

describe('normalizeDiacritics', () => {
  it('strips Vietnamese diacritics, lowercases and trims', () => {
    expect(normalizeDiacritics('  Tone Nữ  ')).toBe('tone nu');
    expect(normalizeDiacritics('Bài Hát Mới')).toBe('bai hat moi');
    expect(normalizeDiacritics('ĐỒNG XANH')).toBe('đong xanh');
  });

  it('is idempotent', () => {
    const once = normalizeDiacritics('Lặng Yên Bên Em');
    expect(normalizeDiacritics(once)).toBe(once);
  });

  it('preserves internal whitespace runs (collapsing is the caller’s job)', () => {
    expect(normalizeDiacritics('hello   world')).toBe('hello   world');
  });

  it('matches the byte output of the previous picker.normalizeText for representative inputs', () => {
    // Snapshot lock-in: any future change to normalizeDiacritics must keep these mappings.
    const cases: Array<[string, string]> = [
      ['Em Của Ngày Hôm Qua', 'em cua ngay hom qua'],
      ['Anh Cứ Đi Đi - Various Artists', 'anh cu đi đi - various artists'],
      ['  TÌNH YÊU MÀU NẮNG  ', 'tinh yeu mau nang'],
      ['Karaoke Beat - Tone Nữ', 'karaoke beat - tone nu'],
    ];
    for (const [input, expected] of cases) {
      expect(normalizeDiacritics(input)).toBe(expected);
    }
  });
});
