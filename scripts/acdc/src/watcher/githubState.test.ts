import { describe, it, expect } from 'vitest';
import { parseProjectItems } from './githubState';

// Fixture matching the VERIFIED real `gh project item-list <n> --owner <o> --format json`
// shape (confirmed against an org board, 2026-06-21): each item has a top-level
// `status`, a top-level `labels` array of label-name strings, and `content.number`.
// (Labels are NOT under content — an earlier wrong assumption that the live proof caught.)
const raw = JSON.stringify({
  items: [
    {
      id: 'PVTI_a',
      status: 'Todo',
      labels: ['agent-ready'],
      content: { number: 5, title: 'Agent-ready issue', type: 'Issue' },
    },
    {
      // draft item: no content.number — must be skipped
      id: 'PVTI_draft',
      status: 'Todo',
      content: { title: 'A draft card' },
    },
    {
      id: 'PVTI_done',
      status: 'Done',
      labels: ['agent-ready', 'human-approved'],
      content: { number: 9, title: 'Finished', type: 'Issue' },
    },
    {
      // legacy/fallback: labels under content (no top-level) — still parsed
      id: 'PVTI_fallback',
      status: 'Todo',
      content: { number: 11, title: 'Fallback', labels: ['agent-ready'] },
    },
  ],
});

describe('parseProjectItems', () => {
  it('reads top-level labels (real shape), skips drafts, falls back to content.labels', () => {
    expect(parseProjectItems(raw)).toEqual([
      { number: 5, labels: ['agent-ready'], status: 'Todo' },
      { number: 9, labels: ['agent-ready', 'human-approved'], status: 'Done' },
      { number: 11, labels: ['agent-ready'], status: 'Todo' },
    ]);
  });

  it('defaults labels to [] and status to "" defensively', () => {
    const r = JSON.stringify({ items: [{ content: { number: 7 } }] });
    expect(parseProjectItems(r)).toEqual([{ number: 7, labels: [], status: '' }]);
  });

  it('returns [] for empty or malformed input', () => {
    expect(parseProjectItems(JSON.stringify({ items: [] }))).toEqual([]);
    expect(parseProjectItems('{}')).toEqual([]);
  });
});
