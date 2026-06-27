import { describe, it, expect } from 'vitest';
import { buildInflight, inflightFilename } from './inflight';

describe('inflight helpers', () => {
  it('builds a record with a zero default attempt', () => {
    expect(buildInflight(42, 1234, 1000)).toEqual({ issue: 42, pid: 1234, startedAt: 1000, attempt: 0 });
  });
  it('carries an explicit attempt', () => {
    expect(buildInflight(42, 1, 2, 3).attempt).toBe(3);
  });
  it('names the per-issue file', () => {
    expect(inflightFilename(42)).toBe('issue-42.json');
  });
});
