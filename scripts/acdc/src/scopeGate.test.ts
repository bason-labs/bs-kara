import { describe, it, expect } from 'vitest';
import { evaluateScopeGate, isAgentBranch } from './scopeGate';

const PROTECTED = [
  '.github/**',
  '.claude/**',
  'scripts/acdc/**',
  'package.json',
  'turbo.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'database.rules.json',
  'bk-web/lib/firebase*',
  'bk-web/**/firebase*',
];

describe('evaluateScopeGate', () => {
  it('passes when only ordinary app files change', () => {
    const r = evaluateScopeGate({
      changedPaths: ['bk-web/features/remote/RemoteClient.tsx'],
      protectedGlobs: PROTECTED,
      humanApproved: false,
    });
    expect(r.pass).toBe(true);
    expect(r.hardViolations).toEqual([]);
  });

  it('hard-fails when a protected control path changes without human approval', () => {
    const r = evaluateScopeGate({
      changedPaths: ['.github/workflows/ci.yml'],
      protectedGlobs: PROTECTED,
      humanApproved: false,
    });
    expect(r.pass).toBe(false);
    expect(r.hardViolations).toContain('.github/workflows/ci.yml');
  });

  it('allows a protected path when a human approved the PR', () => {
    const r = evaluateScopeGate({
      changedPaths: ['scripts/acdc/src/watcher.ts'],
      protectedGlobs: PROTECTED,
      humanApproved: true,
    });
    expect(r.pass).toBe(true);
    expect(r.hardViolations).toEqual([]);
  });

  it('hard-fails on Firebase rules regardless of approval flag being false', () => {
    const r = evaluateScopeGate({
      changedPaths: ['database.rules.json', 'bk-web/lib/firebaseAdmin.ts'],
      protectedGlobs: PROTECTED,
      humanApproved: false,
    });
    expect(r.pass).toBe(false);
    expect(r.hardViolations.sort()).toEqual(
      ['bk-web/lib/firebaseAdmin.ts', 'database.rules.json'].sort(),
    );
  });

  it('emits an advisory warning for out-of-area files but still passes', () => {
    const r = evaluateScopeGate({
      changedPaths: ['bk-mobile/app/index.tsx'],
      protectedGlobs: PROTECTED,
      humanApproved: false,
      areaLabel: 'area:web',
      areaGlobs: { 'area:web': ['bk-web/**'], 'area:mobile': ['bk-mobile/**'] },
    });
    expect(r.pass).toBe(true);
    expect(r.advisoryWarnings).toContain('bk-mobile/app/index.tsx');
  });

  it('passes on an empty changeset', () => {
    const r = evaluateScopeGate({ changedPaths: [], protectedGlobs: PROTECTED, humanApproved: false });
    expect(r.pass).toBe(true);
  });

  it('flags an unknown area label (not multiple, not in the map)', () => {
    const r = evaluateScopeGate({
      changedPaths: ['bk-web/app/page.tsx'],
      protectedGlobs: PROTECTED,
      humanApproved: false,
      areaLabel: 'area:does-not-exist',
      areaGlobs: { 'area:web': ['bk-web/**'] },
    });
    expect(r.unknownArea).toBe(true);
    expect(r.pass).toBe(true);
  });

  it('does not flag area:multiple as unknown', () => {
    const r = evaluateScopeGate({
      changedPaths: ['bk-web/app/page.tsx'],
      protectedGlobs: PROTECTED,
      humanApproved: false,
      areaLabel: 'area:multiple',
      areaGlobs: { 'area:web': ['bk-web/**'] },
    });
    expect(r.unknownArea).toBe(false);
  });

  // The hard gate exists to stop the AUTONOMOUS worker (run/issue-* branches) from
  // changing the control plane unsupervised. A human-authored branch is the
  // maintainer's own change and should pass — modelled by `enforced: false`.
  it('does not hard-fail a protected change when enforced is false (human-authored branch)', () => {
    const r = evaluateScopeGate({
      changedPaths: ['.github/workflows/ci.yml', 'scripts/acdc/src/watcher.ts'],
      protectedGlobs: PROTECTED,
      humanApproved: false,
      enforced: false,
    });
    expect(r.pass).toBe(true);
    expect(r.hardViolations).toEqual([]);
  });

  it('still hard-fails a protected change when enforced is true with no human approval (agent branch)', () => {
    const r = evaluateScopeGate({
      changedPaths: ['scripts/acdc/src/watcher.ts'],
      protectedGlobs: PROTECTED,
      humanApproved: false,
      enforced: true,
    });
    expect(r.pass).toBe(false);
    expect(r.hardViolations).toContain('scripts/acdc/src/watcher.ts');
  });

  it('defaults enforced to true when omitted (unchanged behavior)', () => {
    const r = evaluateScopeGate({
      changedPaths: ['scripts/acdc/src/watcher.ts'],
      protectedGlobs: PROTECTED,
      humanApproved: false,
    });
    expect(r.pass).toBe(false);
  });
});

describe('isAgentBranch', () => {
  it('recognizes the autonomous worker run/issue-N branch', () => {
    expect(isAgentBranch('run/issue-42')).toBe(true);
    expect(isAgentBranch('  run/issue-7  ')).toBe(true);
  });

  it('treats human-authored branches as non-agent', () => {
    for (const b of ['feat/x', 'fix/y', 'chore/z', 'main', 'run/issue-', 'run/issuexyz', 'xrun/issue-1', '']) {
      expect(isAgentBranch(b)).toBe(false);
    }
  });
});
