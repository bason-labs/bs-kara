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
  it('pairs each run/issue-<N> PR with its issue number and author', () => {
    const raw = JSON.stringify([
      { number: 8, headRefName: 'run/issue-7', author: { login: 'bs-kara-bot' } },
      { number: 9, headRefName: 'feature/unrelated', author: { login: 'bs-kara-bot' } },
      { number: 10, headRefName: 'run/issue-12', author: { login: 'someone' } },
    ]);
    expect(openWorkerPrs(raw)).toEqual([
      { pr: 8, issue: 7, author: 'bs-kara-bot' },
      { pr: 10, issue: 12, author: 'someone' },
    ]);
  });
  it('returns an empty list on malformed input', () => {
    expect(openWorkerPrs('not json')).toEqual([]);
  });
});

describe('itemsReadyToMerge', () => {
  const BOT = 'bs-kara-bot';
  const t = (number: number, status: string, labels: string[] = ['agent-ready']): Ticket => ({
    number,
    labels,
    status,
  });
  const pr = (prNum: number, issue: number, author = BOT) => ({ pr: prNum, issue, author });

  it('returns worker-authored In-review, agent-ready tickets that have an open PR', () => {
    const tickets = [
      t(7, 'In review'),
      t(8, 'In Progress'), // not yet In review
      t(9, 'In review', []), // not agent-ready
      t(10, 'In review'), // In review but no PR
    ];
    const prs = [pr(100, 7), pr(101, 8), pr(102, 9)];
    expect(itemsReadyToMerge(tickets, prs, BOT)).toEqual([{ issue: 7, pr: 100 }]);
  });

  it('excludes a PR not authored by the worker bot (e.g. an external fork mimic)', () => {
    const tickets = [t(7, 'In review')];
    expect(itemsReadyToMerge(tickets, [pr(100, 7, 'attacker')], BOT)).toEqual([]);
  });

  it('fails closed when the worker login is empty', () => {
    const tickets = [t(7, 'In review')];
    expect(itemsReadyToMerge(tickets, [pr(100, 7)], '')).toEqual([]);
  });

  it('picks one worker PR per issue (first wins)', () => {
    const tickets = [t(7, 'In review')];
    expect(itemsReadyToMerge(tickets, [pr(100, 7), pr(200, 7)], BOT)).toEqual([{ issue: 7, pr: 100 }]);
  });
});
