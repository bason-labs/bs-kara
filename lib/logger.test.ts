import { afterEach, describe, expect, it, vi } from 'vitest';
import { logError } from './logger';

describe('logError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs the scope, message, and stack for a real Error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');
    logError('youtube', err);
    expect(spy).toHaveBeenCalledTimes(1);
    const [tag, payload] = spy.mock.calls[0];
    expect(tag).toBe('[youtube]');
    expect(payload).toMatchObject({ message: 'boom', digest: undefined });
    expect(typeof payload.stack).toBe('string');
  });

  it('extracts digest from objects that carry one', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = Object.assign(new Error('digested'), { digest: 'abc' });
    logError('route-error', err);
    expect(spy.mock.calls[0][1]).toMatchObject({ digest: 'abc' });
  });

  it('stringifies non-Error values', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('global-error', 'plain string');
    expect(spy.mock.calls[0][1]).toMatchObject({
      message: 'plain string',
      stack: undefined,
    });
  });

  it('merges extra context into the payload', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('suggestions', new Error('e'), { query: 'x' });
    expect(spy.mock.calls[0][1]).toMatchObject({ query: 'x' });
  });
});
