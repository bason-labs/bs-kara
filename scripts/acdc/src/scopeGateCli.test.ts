import { describe, it, expect } from 'vitest';
import { runScopeGate } from './scopeGateCli';

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
});
