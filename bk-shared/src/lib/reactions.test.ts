import { describe, expect, it } from 'vitest';
import { REACTIONS, getGifUrl, getStaticUrl } from './reactions';

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
    expect(getGifUrl('💖')).toBe('/reactions/1f496.gif');
  });

  it('uses the first codepoint for compound strings', () => {
    expect(getGifUrl('🔥xx')).toBe('/reactions/1f525.gif');
  });

  it('falls back to an empty codepoint for empty input', () => {
    expect(getGifUrl('')).toBe('/reactions/.gif');
  });

  it('produces a unique URL for every reaction', () => {
    const urls = REACTIONS.map(getGifUrl);
    expect(new Set(urls).size).toBe(REACTIONS.length);
  });
});

describe('getStaticUrl', () => {
  it('embeds the codepoint hex of the emoji in the URL', () => {
    // 💖 = U+1F496
    expect(getStaticUrl('💖')).toBe('/reactions/1f496.svg');
  });

  it('uses the first codepoint for compound strings', () => {
    expect(getStaticUrl('🔥xx')).toBe('/reactions/1f525.svg');
  });

  it('falls back to an empty codepoint for empty input', () => {
    expect(getStaticUrl('')).toBe('/reactions/.svg');
  });

  it('produces a unique URL for every reaction', () => {
    const urls = REACTIONS.map(getStaticUrl);
    expect(new Set(urls).size).toBe(REACTIONS.length);
  });
});
