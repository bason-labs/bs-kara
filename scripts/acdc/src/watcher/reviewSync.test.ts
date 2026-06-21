import { describe, it, expect } from 'vitest';
import {
  prIssuesFromList,
  itemsNeedingInReview,
  openWorkerPrs,
  itemsReadyToMerge,
} from './reviewSync';
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

describe('openWorkerPrs', () => {
  it('pairs each run/issue-<N> PR number with its issue number', () => {
    const raw = JSON.stringify([
      { number: 8, headRefName: 'run/issue-7' },
      { number: 9, headRefName: 'feature/unrelated' },
      { number: 10, headRefName: 'run/issue-12' },
    ]);
    expect(openWorkerPrs(raw)).toEqual([
      { pr: 8, issue: 7 },
      { pr: 10, issue: 12 },
    ]);
  });
  it('returns an empty list on malformed input', () => {
    expect(openWorkerPrs('not json')).toEqual([]);
  });
});

describe('itemsReadyToMerge', () => {
  const t = (number: number, status: string, labels: string[] = ['agent-ready']): Ticket => ({
    number,
    labels,
    status,
  });
  it('returns {issue,pr} for In-review, agent-ready tickets that have an open PR', () => {
    const tickets = [
      t(7, 'In review'),
      t(8, 'In Progress'), // not yet In review
      t(9, 'In review', []), // not agent-ready
      t(10, 'In review'), // In review but no PR
    ];
    const prs = [
      { pr: 100, issue: 7 },
      { pr: 101, issue: 8 },
      { pr: 102, issue: 9 },
    ];
    expect(itemsReadyToMerge(tickets, prs)).toEqual([{ issue: 7, pr: 100 }]);
  });
  it('picks one PR per issue (first wins)', () => {
    const tickets = [t(7, 'In review')];
    const prs = [
      { pr: 100, issue: 7 },
      { pr: 200, issue: 7 },
    ];
    expect(itemsReadyToMerge(tickets, prs)).toEqual([{ issue: 7, pr: 100 }]);
  });
});
