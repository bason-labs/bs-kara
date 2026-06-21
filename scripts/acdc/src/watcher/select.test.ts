import { describe, it, expect } from 'vitest';
import { selectDispatchable, type Ticket } from './select';
const t = (n: number, labels: string[], status: string): Ticket => ({ number: n, labels, status });
describe('selectDispatchable', () => {
  const tickets = [t(1,['agent-ready'],'Todo'), t(2,['agent-ready','needs-human'],'Todo'), t(3,['agent-ready','blocked'],'Todo'), t(4,['agent-ready'],'In Progress'), t(5,[],'Todo'), t(6,['agent-ready'],'Todo')];
  it('picks only agent-ready, Todo, not needs-human/blocked, not in-flight', () => {
    expect(selectDispatchable(tickets, new Set([6]), 5).map((x)=>x.number)).toEqual([1]);
  });
  it('respects the concurrency cap given current in-flight count', () => {
    expect(selectDispatchable([t(1,['agent-ready'],'Todo'), t(7,['agent-ready'],'Todo')], new Set(), 1)).toHaveLength(1);
  });
  it('returns nothing when the cap is already full', () => {
    expect(selectDispatchable(tickets, new Set([99]), 1)).toEqual([]);
  });
});
