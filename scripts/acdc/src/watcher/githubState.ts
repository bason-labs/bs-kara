import type { Ticket } from './select';

// Parse the output of `gh project item-list <n> --owner <o> --format json`.
//
// Documented shape (must be CONFIRMED against real gh output once the board
// exists — there is no board yet, so this parser is written against the
// documented shape and kept defensive):
//   { items: [
//     { status: <Status column name>,
//       content: { number: <issue #>, labels: [<label name>, ...] } },
//     ...
//   ] }
//
// Draft cards have no `content.number` and are skipped. Everything is read
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
      labels: normalizeLabels(item?.content?.labels),
      status: item?.status ?? '',
    });
  }
  return tickets;
}
