import { describe, it, expect } from 'vitest';
import { evaluateScopeGate } from './scopeGate';

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
});
