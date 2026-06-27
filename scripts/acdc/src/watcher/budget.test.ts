import { describe, it, expect } from 'vitest';
import { dispatchBudget } from './budget';
import type { GuardState, Limits } from './guards';

const limits: Limits = { maxPerWindow: 4, maxPerDay: 12, maxAutoMergesPerWindow: 3, maxAttempts: 2 };
const state = (win: number, day: number): GuardState => ({
  dispatchesThisWindow: win, dispatchesToday: day, autoMergesThisWindow: 0,
});

describe('dispatchBudget', () => {
  it('does not exceed the per-window cap when concurrency slots exceed remaining budget', () => {
    // window has 1 left (3 of 4 used) but 3 concurrency slots are free → only 1 may dispatch
    expect(dispatchBudget(state(3, 5), limits, 3)).toBe(1);
  });
  it('clamps to the remaining daily ceiling', () => {
    expect(dispatchBudget(state(0, 11), limits, 4)).toBe(1);
  });
  it('returns the slot count when budget is ample', () => {
    expect(dispatchBudget(state(0, 0), limits, 2)).toBe(2);
  });
  it('never returns a negative number', () => {
    expect(dispatchBudget(state(9, 99), limits, 2)).toBe(0);
  });
});
