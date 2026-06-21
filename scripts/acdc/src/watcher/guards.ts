export interface Limits { maxPerWindow: number; maxPerDay: number; maxAutoMergesPerWindow: number; maxAttempts: number }
export interface GuardState { dispatchesThisWindow: number; dispatchesToday: number; autoMergesThisWindow: number }
export function withinLimits(s: GuardState, l: Limits): { ok: boolean; reason: string } {
  if (s.dispatchesThisWindow >= l.maxPerWindow) return { ok: false, reason: 'per-window dispatch cap reached' };
  if (s.dispatchesToday >= l.maxPerDay) return { ok: false, reason: 'daily dispatch ceiling reached' };
  return { ok: true, reason: '' };
}
export function circuitTripped(s: GuardState, l: Limits): boolean { return s.autoMergesThisWindow >= l.maxAutoMergesPerWindow; }
export function nextBackoffMs(consecutiveFailures: number): number { return Math.min(300_000, 1000 * 2 ** consecutiveFailures); }
