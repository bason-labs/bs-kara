import { describe, it, expect } from 'vitest';
import { resolveTier, modelForTier, coerceTier, TIER_MODEL } from './tiers';

describe('resolveTier', () => {
  it('prefers the inline tier over a label and the default', () => {
    expect(resolveTier('high', ['tier:low'], 'medium')).toBe('high');
  });
  it('uses a tier:* label when no inline tier is given', () => {
    expect(resolveTier(undefined, ['agent-ready', 'tier:high'], 'medium')).toBe('high');
  });
  it('falls back to the default when neither inline nor label applies', () => {
    expect(resolveTier(undefined, ['agent-ready'], 'medium')).toBe('medium');
  });
  it('ignores unknown inline and label values (no throw)', () => {
    expect(resolveTier('bogus', ['tier:bogus'], 'medium')).toBe('medium');
  });
});

describe('modelForTier', () => {
  it('maps tiers to the default Claude model aliases', () => {
    expect(modelForTier('low', {})).toBe('haiku');
    expect(modelForTier('medium', {})).toBe('sonnet');
    expect(modelForTier('high', {})).toBe('opus');
  });
  it('honors an ACDC_TIER_<TIER> env override', () => {
    expect(modelForTier('high', { ACDC_TIER_HIGH: 'claude-opus-4-8' })).toBe('claude-opus-4-8');
  });
});

describe('coerceTier', () => {
  it('returns a valid tier and falls back to the default otherwise', () => {
    expect(coerceTier('low', 'medium')).toBe('low');
    expect(coerceTier('nope', 'medium')).toBe('medium');
    expect(coerceTier(undefined, 'high')).toBe('high');
  });
});

describe('TIER_MODEL', () => {
  it('exposes a model for every tier', () => {
    expect(Object.keys(TIER_MODEL).sort()).toEqual(['high', 'low', 'medium']);
  });
});
