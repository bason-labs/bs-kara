import { describe, it, expect } from 'vitest';
import { parseProjectItems } from './githubState';

// Fixture modeled on the documented `gh project item-list <n> --owner <o> --format json`
// shape: a JSON object with an `items` array. Each item has `.content.number`,
// `.content.labels` (array of label-name strings) and a top-level `status` field
// holding the Status column name. The exact gh JSON shape must be confirmed against
// real output once the board exists (no board yet).
const raw = JSON.stringify({
  items: [
    {
      id: 'PVTI_a',
      status: 'Todo',
      content: { number: 5, title: 'Agent-ready issue', labels: ['agent-ready'] },
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
      content: { number: 9, title: 'Finished', labels: ['agent-ready', 'human-approved'] },
    },
  ],
});

describe('parseProjectItems', () => {
  it('maps items to Ticket[], skipping items without content.number', () => {
    expect(parseProjectItems(raw)).toEqual([
      { number: 5, labels: ['agent-ready'], status: 'Todo' },
      { number: 9, labels: ['agent-ready', 'human-approved'], status: 'Done' },
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
