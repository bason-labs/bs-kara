import { describe, it, expect } from 'vitest';
import { parseDispatchOneArgs } from './dispatchOne';

describe('parseDispatchOneArgs', () => {
  it('parses the issue number and a bare tier', () => {
    expect(parseDispatchOneArgs(['42', 'high'])).toEqual({ issue: 42, tier: 'high' });
  });
  it('accepts a tier=<v> form', () => {
    expect(parseDispatchOneArgs(['42', 'tier=low'])).toEqual({ issue: 42, tier: 'low' });
  });
  it('leaves tier undefined when omitted', () => {
    expect(parseDispatchOneArgs(['42'])).toEqual({ issue: 42, tier: undefined });
  });
  it('throws on a missing or non-numeric issue', () => {
    expect(() => parseDispatchOneArgs([])).toThrow(/issue/i);
    expect(() => parseDispatchOneArgs(['x'])).toThrow(/issue/i);
  });
});
