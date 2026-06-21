import type { Ticket } from './select';

/** Parse `gh pr list --json number,headRefName` output → set of issue numbers with an open run/issue-<N> PR. */
export function prIssuesFromList(raw: string): Set<number> {
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return new Set();
  }
  if (!Array.isArray(arr)) return new Set();
  const out = new Set<number>();
  for (const pr of arr) {
    const head = (pr as { headRefName?: string })?.headRefName ?? '';
    const m = /^run\/issue-(\d+)$/.exec(head);
    if (m) out.add(Number(m[1]));
  }
  return out;
}

/** Tickets currently "In Progress" that have an open PR should move to "In review". */
export function itemsNeedingInReview(tickets: Ticket[], prIssues: Set<number>): number[] {
  return tickets
    .filter((t) => t.status === 'In Progress' && prIssues.has(t.number))
    .map((t) => t.number);
}

/** A worker PR paired with the issue its head branch encodes, plus its author. */
export interface OpenPr {
  pr: number;
  issue: number;
  author: string;
}

/** A merge candidate: the issue and the PR the watcher should consider. */
export interface ReadyPr {
  issue: number;
  pr: number;
}

/** Parse `gh pr list --json number,headRefName,author` → {pr, issue, author} for run/issue-<N> heads. */
export function openWorkerPrs(raw: string): OpenPr[] {
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: OpenPr[] = [];
  for (const p of arr) {
    const head = (p as { headRefName?: string })?.headRefName ?? '';
    const num = (p as { number?: number })?.number;
    const author = (p as { author?: { login?: string } })?.author?.login ?? '';
    const m = /^run\/issue-(\d+)$/.exec(head);
    if (m && typeof num === 'number') out.push({ pr: num, issue: Number(m[1]), author });
  }
  return out;
}

/**
 * Tickets in "In review" that are agent-ready and have an open WORKER-AUTHORED PR.
 * Only PRs authored by the worker bot (`author === workerLogin`) are eligible, so a
 * non-worker PR (e.g. an external fork) that mimics the `run/issue-N` naming cannot
 * enter the merge path. One PR per issue (first wins). Fail-closed: an empty
 * workerLogin matches nothing.
 */
export function itemsReadyToMerge(tickets: Ticket[], prs: OpenPr[], workerLogin: string): ReadyPr[] {
  const bot = workerLogin.toLowerCase();
  const byIssue = new Map<number, number>();
  for (const p of prs) {
    if (!bot || p.author.toLowerCase() !== bot) continue; // worker-authored PRs only
    if (!byIssue.has(p.issue)) byIssue.set(p.issue, p.pr);
  }
  return tickets
    .filter(
      (t) =>
        t.status === 'In review' &&
        t.labels.includes('agent-ready') &&
        byIssue.has(t.number),
    )
    .map((t) => ({ issue: t.number, pr: byIssue.get(t.number) as number }));
}
