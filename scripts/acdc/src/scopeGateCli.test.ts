import { describe, it, expect } from 'vitest';
import { runScopeGate, parseChangedPaths, PROTECTED_GLOBS } from './scopeGateCli';

describe('runScopeGate', () => {
  it('returns exit code 1 and prints violations when a protected path is touched', () => {
    const lines: string[] = [];
    const code = runScopeGate(
      { changedPaths: ['.github/workflows/ci.yml'], humanApproved: false },
      (m) => lines.push(m),
    );
    expect(code).toBe(1);
    expect(lines.join('\n')).toContain('.github/workflows/ci.yml');
  });

  it('returns exit code 0 on an in-scope change', () => {
    const lines: string[] = [];
    const code = runScopeGate(
      { changedPaths: ['bk-web/app/page.tsx'], humanApproved: false },
      (m) => lines.push(m),
    );
    expect(code).toBe(0);
  });

  it('returns 0 for a protected path when humanApproved is true', () => {
    const code = runScopeGate(
      { changedPaths: ['scripts/acdc/src/watcher.ts'], humanApproved: true },
      () => {},
    );
    expect(code).toBe(0);
  });

  it('warns on an out-of-area change through the real AREA_GLOBS but still passes', () => {
    const lines: string[] = [];
    const code = runScopeGate(
      { changedPaths: ['bk-mobile/app/x.tsx'], humanApproved: false, areaLabel: 'area:web' },
      (m) => lines.push(m),
    );
    expect(code).toBe(0);
    expect(lines.join('\n')).toContain('::warning::out-of-area change: bk-mobile/app/x.tsx');
  });

  it('warns on an unknown area label', () => {
    const lines: string[] = [];
    const code = runScopeGate(
      { changedPaths: ['bk-web/app/page.tsx'], humanApproved: false, areaLabel: 'area:nope' },
      (m) => lines.push(m),
    );
    expect(code).toBe(0);
    expect(lines.join('\n')).toContain('unknown area label: area:nope');
  });
});

describe('PROTECTED_GLOBS', () => {
  it('protects the key automation-control paths', () => {
    for (const g of ['.github/**', 'database.rules.json', 'scripts/acdc/**', '.coderabbit.yaml']) {
      expect(PROTECTED_GLOBS).toContain(g);
    }
  });

  it('blocks an unapproved change to the CodeRabbit review-gate config', () => {
    // .coderabbit.yaml configures the independent review gate; the autonomous agent
    // must not be able to weaken it without a human (same rule as .gitleaks.toml).
    const code = runScopeGate(
      { changedPaths: ['.coderabbit.yaml'], humanApproved: false },
      () => {},
    );
    expect(code).toBe(1);
  });
});

describe('parseChangedPaths', () => {
  it('splits, trims, and drops blank lines', () => {
    expect(parseChangedPaths('a\n b \n\n c\n')).toEqual(['a', 'b', 'c']);
  });
});
