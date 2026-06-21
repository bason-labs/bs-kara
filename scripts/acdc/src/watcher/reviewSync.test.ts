import { describe, it, expect } from 'vitest';
import { prIssuesFromList, itemsNeedingInReview } from './reviewSync';
import type { Ticket } from './select';

describe('prIssuesFromList', () => {
  it('extracts issue numbers from run/issue-<N> head branches', () => {
    const raw = JSON.stringify([
      { number: 8, headRefName: 'run/issue-7' },
      { number: 9, headRefName: 'feature/unrelated' },
      { number: 10, headRefName: 'run/issue-12' },
    ]);
    expect([...prIssuesFromList(raw)].sort((a, b) => a - b)).toEqual([7, 12]);
  });
  it('returns an empty set on malformed input', () => {
    expect(prIssuesFromList('not json').size).toBe(0);
  });
});

describe('itemsNeedingInReview', () => {
  const t = (number: number, status: string): Ticket => ({ number, labels: [], status });
  it('returns In-Progress tickets that have an open PR', () => {
    const tickets = [t(7, 'In Progress'), t(8, 'In Progress'), t(9, 'Todo'), t(10, 'In review')];
    const out = itemsNeedingInReview(tickets, new Set([7, 9, 10]));
    expect(out).toEqual([7]); // 8 has no PR; 9 is Todo; 10 already In review
  });
});
