import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRoomAccess } from './useRoomAccess';

function stubAccess(...responses: Array<{ status: number; body?: unknown } | Error>) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fetchMock.mockRejectedValueOnce(r);
    else fetchMock.mockResolvedValueOnce({ status: r.status, json: async () => r.body });
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const flush = () => act(async () => {});

afterEach(() => vi.unstubAllGlobals());

describe('useRoomAccess', () => {
  it.each([
    ['allowed', { status: 200, body: { allowed: true, reason: 'ok' } }, true, null],
    ['expired', { status: 200, body: { allowed: false, reason: 'subscription_expired' } }, false, 'subscription_expired'],
    ['a server error (fails open)', { status: 503, body: {} }, true, null],
    ['a network error (fails open)', new Error('offline'), true, null],
  ] as const)('reports %s', async (_label, response, isAllowed, blockedReason) => {
    stubAccess(response);
    const { result } = renderHook(() => useRoomAccess('4489'));
    expect(result.current.isChecking).toBe(true);
    await flush();
    expect(result.current).toMatchObject({ isChecking: false, isAllowed, blockedReason });
  });

  it('does not call the server for a code already marked allowed', async () => {
    const fetchMock = stubAccess();
    const { result, rerender } = renderHook(({ code }) => useRoomAccess(code), { initialProps: { code: null as string | null } });
    act(() => result.current.markAllowed('4489'));
    rerender({ code: '4489' });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isAllowed).toBe(true);
  });

  it('re-checks the same code after it was cleared, so a renewed room opens', async () => {
    const fetchMock = stubAccess(
      { status: 200, body: { allowed: false, reason: 'subscription_expired' } },
      { status: 200, body: { allowed: true, reason: 'ok' } },
    );
    const { result, rerender } = renderHook(({ code }) => useRoomAccess(code), { initialProps: { code: '4489' as string | null } });
    await flush();
    expect(result.current.blockedReason).toBe('subscription_expired');
    rerender({ code: null });
    rerender({ code: '4489' });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.isAllowed).toBe(true);
  });
});
