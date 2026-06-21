import { describe, it, expect } from 'vitest';
import { GREEN_BAR } from './greenBar';

describe('GREEN_BAR', () => {
  it('runs the steps in order: build, check, e2e', () => {
    expect(GREEN_BAR.map((s) => s.name)).toEqual(['build', 'check', 'e2e']);
  });

  it('builds before it checks', () => {
    const buildIdx = GREEN_BAR.findIndex((s) => s.name === 'build');
    const checkIdx = GREEN_BAR.findIndex((s) => s.name === 'check');
    expect(buildIdx).toBeLessThan(checkIdx);
  });

  it('runs playwright in the e2e step', () => {
    const e2e = GREEN_BAR.find((s) => s.name === 'e2e');
    expect(e2e?.cmd).toContain('playwright test');
  });
});
