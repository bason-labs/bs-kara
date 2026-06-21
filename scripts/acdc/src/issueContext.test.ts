import { describe, it, expect } from 'vitest';
import { parseAgentTaskIssue } from './issueContext';

const BODY = `### Context

Add a clear-search-history button.

### Acceptance criteria

- Button clears history
- Hidden when empty

### Scope boundaries

Do not touch the queue.

### Area

web

### Proof of work

- [x] I confirm a passing Playwright e2e + recorded video will be linked on the PR.`;

describe('parseAgentTaskIssue', () => {
  it('extracts the four sections and the area', () => {
    const t = parseAgentTaskIssue(BODY);
    expect(t.context).toContain('clear-search-history');
    expect(t.acceptance).toContain('clears history');
    expect(t.scope).toContain('Do not touch the queue');
    expect(t.area).toBe('web');
  });
  it('throws when a required section is missing', () => {
    expect(() => parseAgentTaskIssue('### Context\n\nx')).toThrow(/missing/i);
  });
});
