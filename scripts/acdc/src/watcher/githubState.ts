import type { Ticket } from './select';

// Parse the output of `gh project item-list <n> --owner <o> --format json`.
//
// Verified shape (against a real org board, 2026-06-21):
//   { items: [
//     { status: <Status column name>,            // top-level
//       labels: [<label name string>, ...],      // top-level (NOT under content)
//       content: { number: <issue #>, ... } },   // number under content
//     ...
//   ] }
//
// Draft cards have no `content.number` and are skipped. Labels are read from the
// item top level (with content.labels as a defensive fallback). Everything is read
// through optional chaining with safe defaults so a shape surprise degrades
// gracefully rather than throwing.
interface RawLabel {
  name?: string;
}
interface RawContent {
  number?: number;
  labels?: Array<string | RawLabel>;
}
interface RawItem {
  status?: string;
  labels?: Array<string | RawLabel>;
  content?: RawContent;
}
interface RawPayload {
  items?: RawItem[];
}

function normalizeLabels(labels: RawContent['labels']): string[] {
  if (!Array.isArray(labels)) return [];
  return labels
    .map((l) => (typeof l === 'string' ? l : l?.name))
    .filter((name): name is string => typeof name === 'string');
}

export function parseProjectItems(raw: string): Ticket[] {
  let payload: RawPayload;
  try {
    payload = JSON.parse(raw) as RawPayload;
  } catch {
    return [];
  }
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const tickets: Ticket[] = [];
  for (const item of items) {
    const number = item?.content?.number;
    if (typeof number !== 'number') continue; // skip drafts / contentless cards
    tickets.push({
      number,
      labels: normalizeLabels(item?.labels ?? item?.content?.labels),
      status: item?.status ?? '',
    });
  }
  return tickets;
}
