import { describe, it, expect } from 'vitest';
import { withinLimits, nextBackoffMs, canAutoMerge, type Limits } from './guards';
const limits: Limits = { maxPerWindow: 4, maxPerDay: 12, maxAutoMergesPerWindow: 3, maxAttempts: 2 };
describe('guards', () => {
  it('allows dispatch under limits', () => { expect(withinLimits({dispatchesThisWindow:1,dispatchesToday:2,autoMergesThisWindow:0}, limits).ok).toBe(true); });
  it('blocks at per-window cap', () => { expect(withinLimits({dispatchesThisWindow:4,dispatchesToday:5,autoMergesThisWindow:0}, limits).ok).toBe(false); });
  it('blocks at daily ceiling', () => { expect(withinLimits({dispatchesThisWindow:0,dispatchesToday:12,autoMergesThisWindow:0}, limits).ok).toBe(false); });
  it('canAutoMerge while under the per-window auto-merge cap', () => { expect(canAutoMerge({dispatchesThisWindow:0,dispatchesToday:0,autoMergesThisWindow:2}, limits)).toBe(true); });
  it('stops auto-merging at the per-window cap (no global pause)', () => { expect(canAutoMerge({dispatchesThisWindow:0,dispatchesToday:0,autoMergesThisWindow:3}, limits)).toBe(false); });
  it('backoff grows exponentially and is capped', () => { expect(nextBackoffMs(0)).toBe(1000); expect(nextBackoffMs(3)).toBe(8000); expect(nextBackoffMs(20)).toBeLessThanOrEqual(300000); });
});
