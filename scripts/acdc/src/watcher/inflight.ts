import type { InFlightRecord } from './runState';

// The persisted inflight record: reconcile-relevant fields + the dispatch attempt count.
export interface InflightFile extends InFlightRecord {
  attempt: number;
  itemId?: string;
}

export function inflightFilename(issue: number): string {
  return `issue-${issue}.json`;
}

export function buildInflight(issue: number, pid: number, startedAt: number, attempt = 0): InflightFile {
  return { issue, pid, startedAt, attempt };
}
