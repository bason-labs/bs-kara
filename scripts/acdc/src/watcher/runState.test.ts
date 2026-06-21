import { describe, it, expect } from 'vitest';
import { classifyExit, reconcile, type InFlightRecord } from './runState';
describe('classifyExit', () => {
  it('detects auth failure', () => { expect(classifyExit(1,'OAuth token expired').kind).toBe('auth'); expect(classifyExit(1,'user interaction is not allowed').kind).toBe('auth'); });
  it('detects success vs crash', () => { expect(classifyExit(0,'').kind).toBe('success'); expect(classifyExit(1,'TypeError: x').kind).toBe('crash'); });
});
describe('reconcile', () => {
  const alive = (pid: number) => pid === 111;
  it('returns dead-PID issues separately from alive', () => {
    const recs: InFlightRecord[] = [{issue:1,pid:111,startedAt:0},{issue:2,pid:222,startedAt:0}];
    const r = reconcile(recs, alive);
    expect(r.alive.map((x)=>x.issue)).toEqual([1]);
    expect(r.dead.map((x)=>x.issue)).toEqual([2]);
  });
});
