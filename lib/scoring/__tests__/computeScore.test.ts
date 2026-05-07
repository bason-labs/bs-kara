import { describe, it, expect } from 'vitest';
import {
  computeScore,
  INSUFFICIENT_SIGNAL_THRESHOLD,
  REACTION_WEIGHTS,
  VERDICT_TABLE,
} from '@/lib/scoring';

const fire = { emoji: '🔥' };       // weight 1.5
const heart = { emoji: '💖' };      // weight 1.2
const clap = { emoji: '👏' };       // weight 0.8
const unknown = { emoji: '❓' };    // weight 0 (default)

describe('computeScore — state 0 (no reactions)', () => {
  it('returns state 0 with empty verdict for empty reactions', () => {
    const r = computeScore({ reactions: [] });
    expect(r.state).toBe(0);
    expect(r.value).toBe(0);
    expect(r.verdict).toBe('');
  });
});

describe('computeScore — state 1 (below threshold)', () => {
  it('returns state 1 for one fire reaction (sum 1.5 < 3)', () => {
    const r = computeScore({ reactions: [fire] });
    expect(r.state).toBe(1);
    expect(r.value).toBe(0);
    expect(r.verdict).toBe('');
  });

  it('returns state 1 for two clap reactions (sum 1.6 < 3)', () => {
    const r = computeScore({ reactions: [clap, clap] });
    expect(r.state).toBe(1);
  });

  it('treats unknown emojis as weight 0 (one fire + many unknown stays state 1)', () => {
    const r = computeScore({
      reactions: [fire, unknown, unknown, unknown, unknown],
    });
    expect(r.state).toBe(1);
  });
});

describe('computeScore — state 2 (at or above threshold)', () => {
  it('three fire reactions cross threshold (sum 4.5 ≥ 3)', () => {
    const r = computeScore({ reactions: [fire, fire, fire] });
    expect(r.state).toBe(2);
    expect(r.value).toBeGreaterThan(0);
  });

  it('five mixed reactions land in state 2', () => {
    const r = computeScore({ reactions: [fire, fire, heart, heart, clap] });
    expect(r.state).toBe(2);
  });

  it('ten fire reactions cap value at 100 and tier S', () => {
    const r = computeScore({ reactions: Array(10).fill(fire) });
    expect(r.state).toBe(2);
    expect(r.value).toBeLessThanOrEqual(100);
    expect(r.value).toBeGreaterThanOrEqual(90);
    expect(r.tier).toBe('S');
  });

  it('mixed positive + negative weights — net positive stays in state 2', () => {
    const r = computeScore({
      reactions: [
        { emoji: '🔥' }, { emoji: '🔥' }, { emoji: '🔥' },
        { emoji: '👎' }, { emoji: '👎' },
      ],
      weights: { '🔥': 2, '👎': -1 },
    });
    // sum = 6 - 2 = 4 (≥ threshold)
    expect(r.state).toBe(2);
    expect(r.value).toBeGreaterThan(0);
  });

  it('negative weights dragging sum below threshold demote to state 1', () => {
    const r = computeScore({
      reactions: [
        { emoji: '🔥' }, { emoji: '🔥' },
        { emoji: '👎' }, { emoji: '👎' }, { emoji: '👎' },
      ],
      weights: { '🔥': 2, '👎': -1 },
    });
    // sum = 4 - 3 = 1 < 3
    expect(r.state).toBe(1);
  });
});

describe('computeScore — threshold edges', () => {
  it('weighted sum exactly 3 → state 2', () => {
    const r = computeScore({
      reactions: [{ emoji: 'X' }],
      weights: { X: 3 },
    });
    expect(r.state).toBe(2);
  });

  it('weighted sum 2.9 → state 1', () => {
    const r = computeScore({
      reactions: [{ emoji: 'X' }],
      weights: { X: 2.9 },
    });
    expect(r.state).toBe(1);
  });
});

describe('computeScore — verdict resolution', () => {
  it('returns the tier letter as verdict when locale is omitted', () => {
    const r = computeScore({ reactions: Array(10).fill(fire) });
    expect(r.verdict).toBe(r.tier);
  });

  it('returns the localized phrase when locale is provided', () => {
    const r = computeScore({ reactions: Array(10).fill(fire), locale: 'vi' });
    expect(r.verdict).toBe(VERDICT_TABLE[r.tier].vi);
  });

  it('localized phrase differs across locales for the same tier', () => {
    const vi = computeScore({ reactions: Array(10).fill(fire), locale: 'vi' });
    const en = computeScore({ reactions: Array(10).fill(fire), locale: 'en' });
    expect(vi.tier).toBe(en.tier);
    expect(vi.verdict).not.toBe(en.verdict);
  });
});

describe('exported constants', () => {
  it('INSUFFICIENT_SIGNAL_THRESHOLD is 3', () => {
    expect(INSUFFICIENT_SIGNAL_THRESHOLD).toBe(3);
  });

  it('REACTION_WEIGHTS covers the production reaction set with positive weights', () => {
    for (const emoji of ['💖', '🔥', '🎉', '👏', '🥳']) {
      expect(REACTION_WEIGHTS[emoji]).toBeGreaterThan(0);
    }
  });
});
