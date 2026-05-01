import { describe, expect, it } from 'vitest';
import { REACTIONS, getGifUrl } from './reactions';

describe('REACTIONS', () => {
  it('exposes a non-empty list of emoji', () => {
    expect(REACTIONS.length).toBeGreaterThan(0);
    for (const r of REACTIONS) {
      expect(typeof r).toBe('string');
      expect(r.length).toBeGreaterThan(0);
    }
  });
});

describe('getGifUrl', () => {
  it('embeds the codepoint hex of the emoji in the URL', () => {
    // 💖 = U+1F496
    expect(getGifUrl('💖')).toBe(
      'https://fonts.gstatic.com/s/e/notoemoji/latest/1f496/512.gif',
    );
  });

  it('uses the first codepoint for compound strings', () => {
    expect(getGifUrl('🔥xx')).toBe(
      'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif',
    );
  });

  it('falls back to an empty codepoint for empty input', () => {
    expect(getGifUrl('')).toBe(
      'https://fonts.gstatic.com/s/e/notoemoji/latest//512.gif',
    );
  });

  it('produces a unique URL for every reaction', () => {
    const urls = REACTIONS.map(getGifUrl);
    expect(new Set(urls).size).toBe(REACTIONS.length);
  });
});
