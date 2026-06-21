import { describe, it, expect } from 'vitest';
import {
  decideMerge,
  computeIndependentGate,
  buildMergeInput,
  type MergeInput,
} from './mergeDecision';

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

describe('computeIndependentGate', () => {
  it('passes when CodeRabbit APPROVED and there are no blocking findings', () => {
    const g = computeIndependentGate({
      reviews: [{ author: 'coderabbitai[bot]', state: 'APPROVED' }],
      checks: [],
    });
    expect(g.independentGatePass).toBe(true);
    expect(g.blockingFindings).toBe(0);
  });

  it('does not pass and reports a blocking finding when CodeRabbit requested changes', () => {
    const g = computeIndependentGate({
      reviews: [{ author: 'coderabbitai[bot]', state: 'CHANGES_REQUESTED' }],
      checks: [],
    });
    expect(g.independentGatePass).toBe(false);
    expect(g.blockingFindings).toBe(1);
  });

  it('does not pass on a COMMENTED-only CodeRabbit review (refuses merge-by-absence)', () => {
    const g = computeIndependentGate({
      reviews: [{ author: 'coderabbitai[bot]', state: 'COMMENTED' }],
      checks: [],
    });
    expect(g.independentGatePass).toBe(false);
    expect(g.blockingFindings).toBe(0);
  });

  it('does not pass when no independent gate produced any signal', () => {
    const g = computeIndependentGate({
      reviews: [{ author: 'thienba', state: 'APPROVED' }],
      checks: [{ name: 'build-test', conclusion: 'SUCCESS' }],
    });
    expect(g.independentGatePass).toBe(false);
  });

  it('does not pass when CodeRabbit approved but the Sonar check failed', () => {
    const g = computeIndependentGate({
      reviews: [{ author: 'coderabbitai', state: 'APPROVED' }],
      checks: [{ name: 'SonarCloud Code Analysis', conclusion: 'FAILURE' }],
    });
    expect(g.independentGatePass).toBe(false);
    expect(g.blockingFindings).toBe(1);
  });

  it('passes on a green Sonar check even without a CodeRabbit review', () => {
    const g = computeIndependentGate({
      reviews: [],
      checks: [{ name: 'SonarCloud Code Analysis', conclusion: 'SUCCESS' }],
    });
    expect(g.independentGatePass).toBe(true);
  });

  it('ignores a spoofed author that merely contains "coderabbit" (exact-identity match)', () => {
    const g = computeIndependentGate({
      reviews: [{ author: 'coderabbitai-evil', state: 'APPROVED' }],
      checks: [],
    });
    expect(g.independentGatePass).toBe(false);
  });

  it('ignores a check whose name merely contains "sonar" (start-anchored match)', () => {
    const g = computeIndependentGate({
      reviews: [],
      checks: [{ name: 'MySonarThing', conclusion: 'SUCCESS' }],
    });
    expect(g.independentGatePass).toBe(false);
  });

  it('uses the LATEST CodeRabbit review state (changes-requested then approved = pass)', () => {
    const g = computeIndependentGate({
      reviews: [
        { author: 'coderabbitai[bot]', state: 'CHANGES_REQUESTED' },
        { author: 'coderabbitai[bot]', state: 'APPROVED' },
      ],
      checks: [],
    });
    expect(g.independentGatePass).toBe(true);
    expect(g.blockingFindings).toBe(0);
  });
});

describe('buildMergeInput', () => {
  const GREEN_PR = {
    labels: [{ name: 'auto-merge' }],
    reviews: [{ author: { login: 'coderabbitai[bot]' }, state: 'APPROVED' }],
    statusCheckRollup: [
      { name: 'build-test', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { name: 'scope-gate', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { name: 'secret-scan', status: 'COMPLETED', conclusion: 'SUCCESS' },
    ],
  };

  it('produces a mergeable input from a fully green, approved, labelled PR', () => {
    const input = buildMergeInput(GREEN_PR);
    expect(decideMerge(input)).toEqual({ merge: true, reason: 'all positive gate signals present' });
  });

  it('blocks when the auto-merge label is missing', () => {
    const input = buildMergeInput({ ...GREEN_PR, labels: [] });
    expect(input.hasAutoMergeLabel).toBe(false);
    expect(decideMerge(input).merge).toBe(false);
  });

  it('treats a red required check as not-passing', () => {
    const input = buildMergeInput({
      ...GREEN_PR,
      statusCheckRollup: [{ name: 'build-test', status: 'COMPLETED', conclusion: 'FAILURE' }],
    });
    expect(input.requiredChecksPass).toBe(false);
  });

  it('treats a pending check as not-passing', () => {
    const input = buildMergeInput({
      ...GREEN_PR,
      statusCheckRollup: [{ name: 'build-test', status: 'IN_PROGRESS', conclusion: '' }],
    });
    expect(input.requiredChecksPass).toBe(false);
  });

  it('normalises a legacy StatusContext (context/state) check shape', () => {
    const input = buildMergeInput({
      ...GREEN_PR,
      statusCheckRollup: [{ context: 'ci/legacy', state: 'SUCCESS' }],
    });
    expect(input.requiredChecksPass).toBe(true);
  });

  it('does not pass the independent gate when CodeRabbit only COMMENTED', () => {
    const input = buildMergeInput({
      ...GREEN_PR,
      reviews: [{ author: { login: 'coderabbitai[bot]' }, state: 'COMMENTED' }],
    });
    expect(input.independentGatePass).toBe(false);
    expect(decideMerge(input).reason).toMatch(/independent/i);
  });
});
