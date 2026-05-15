import { describe, it, expect } from 'vitest';
import { buildCalendarDays, formatDisplay } from './SubscriptionForm';

describe('buildCalendarDays', () => {
  it('returns exactly 42 cells', () => {
    expect(buildCalendarDays(2026, 4).length).toBe(42);
  });

  it('starts on the Monday of the week containing the 1st', () => {
    // May 1 2026 is a Friday → week starts Mon Apr 27
    const cells = buildCalendarDays(2026, 4);
    expect(cells[0].date.getDate()).toBe(27);
    expect(cells[0].date.getMonth()).toBe(3); // April = 3
  });

  it('marks days outside the viewed month as currentMonth: false', () => {
    const cells = buildCalendarDays(2026, 4); // May 2026
    expect(cells[0].currentMonth).toBe(false); // Apr 27
    expect(cells[4].currentMonth).toBe(true);  // May 1
  });

  it('handles a month starting on Monday (zero leading days)', () => {
    // June 1 2026 is a Monday
    const cells = buildCalendarDays(2026, 5);
    expect(cells[0].date.getDate()).toBe(1);
    expect(cells[0].date.getMonth()).toBe(5); // June = 5
    expect(cells[0].currentMonth).toBe(true);
  });

  it('handles February in a leap year (29 days)', () => {
    const cells = buildCalendarDays(2028, 1);
    expect(cells.length).toBe(42);
    expect(cells.filter((c) => c.currentMonth).length).toBe(29);
  });
});

describe('formatDisplay', () => {
  it('formats YYYY-MM-DD as dd/MM/yyyy', () => {
    expect(formatDisplay('2026-05-15')).toBe('15/05/2026');
  });

  it('returns empty string for empty input', () => {
    expect(formatDisplay('')).toBe('');
  });
});
