import type { GuardState, Limits } from './guards';

// How many workers may actually be dispatched THIS tick. `withinLimits` only gates
// whether to dispatch at all; with maxConcurrent > 1 a single tick could otherwise
// overshoot the per-window/day caps. Clamp the candidate count to the remaining budget.
export function dispatchBudget(state: GuardState, limits: Limits, slots: number): number {
  const windowLeft = limits.maxPerWindow - state.dispatchesThisWindow;
  const dayLeft = limits.maxPerDay - state.dispatchesToday;
  return Math.max(0, Math.min(slots, windowLeft, dayLeft));
}
