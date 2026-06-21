export interface Ticket { number: number; labels: string[]; status: string }
export function selectDispatchable(tickets: Ticket[], inFlight: Set<number>, cap: number): Ticket[] {
  const slots = Math.max(0, cap - inFlight.size);
  if (slots === 0) return [];
  return tickets.filter((t) =>
    t.status === 'Todo' && t.labels.includes('agent-ready') &&
    !t.labels.includes('needs-human') && !t.labels.includes('blocked') && !inFlight.has(t.number)
  ).slice(0, slots);
}
