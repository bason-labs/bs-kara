import { describe, it, expect, vi, afterEach } from 'vitest';
import { ptDateKey } from './ptDateKey';

afterEach(() => {
  vi.useRealTimers();
});

describe('ptDateKey', () => {
  it('returns a YYYYMMDD string with no dashes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    const result = ptDateKey();
    expect(result).toMatch(/^\d{8}$/);
    expect(result).not.toContain('-');
  });

  it('daysAgo = 0 returns today in PT timezone', () => {
    // noon UTC on Jan 15 is still Jan 15 in PT (UTC-8 in January)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    const result = ptDateKey(0);
    // UTC-8 → Jan 15 12:00 UTC = Jan 15 04:00 PT, so still Jan 15 PT
    expect(result).toBe('20260115');
  });

  it('daysAgo = 1 returns yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    const result = ptDateKey(1);
    expect(result).toBe('20260114');
  });

  it('daysAgo = 29 returns the correct date 29 days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));
    const result = ptDateKey(29);
    expect(result).toBe('20260102');
  });
});
