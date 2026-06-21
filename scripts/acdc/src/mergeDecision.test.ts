import { describe, it, expect } from 'vitest';
import { decideMerge, type MergeInput } from './mergeDecision';

const ALL_GOOD: MergeInput = {
  hasAutoMergeLabel: true,
  requiredChecksPass: true,
  independentGatePass: true,
  blockingFindings: 0,
  dismissedBlockingFindings: 0,
};

describe('decideMerge', () => {
  it('merges when every positive gate signal is present', () => {
    expect(decideMerge(ALL_GOOD)).toEqual({
      merge: true,
      reason: 'all positive gate signals present',
    });
  });

  it('does not merge when the auto-merge label is absent', () => {
    const r = decideMerge({ ...ALL_GOOD, hasAutoMergeLabel: false });
    expect(r.merge).toBe(false);
    expect(r.reason).toMatch(/auto-merge label/i);
  });

  it('does not merge when required checks are red', () => {
    const r = decideMerge({ ...ALL_GOOD, requiredChecksPass: false });
    expect(r.merge).toBe(false);
    expect(r.reason).toMatch(/ci checks/i);
  });

  it('does not merge when no independent gate passed', () => {
    const r = decideMerge({ ...ALL_GOOD, independentGatePass: false });
    expect(r.merge).toBe(false);
    expect(r.reason).toMatch(/independent/i);
  });

  it('does not merge when there are unresolved blocking findings', () => {
    const r = decideMerge({ ...ALL_GOOD, blockingFindings: 2 });
    expect(r.merge).toBe(false);
    expect(r.reason).toMatch(/blocking finding/i);
  });

  it('does not merge when a blocking finding was dismissed instead of fixed', () => {
    const r = decideMerge({ ...ALL_GOOD, dismissedBlockingFindings: 1 });
    expect(r.merge).toBe(false);
    expect(r.reason).toMatch(/dismissed|human/i);
  });
});
