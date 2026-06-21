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
