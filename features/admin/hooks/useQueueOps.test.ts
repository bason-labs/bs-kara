import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQueueOps } from './useQueueOps';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fakeOps = {
  rooms: [{ roomId: '1234', adds: 8, removes: 3 }],
  totalAdds: 8,
  totalRemoves: 3,
};

describe('useQueueOps', () => {
  it('starts in loading state', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useQueueOps());
    expect(result.current.loading).toBe(true);
  });

  it('populates data on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, fakeOps));
    const { result } = renderHook(() => useQueueOps());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data).toEqual(fakeOps);
  });

  it('sets error on non-200', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(401, { error: 'no_cookie' }));
    const { result } = renderHook(() => useQueueOps());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.error).toBe('no_cookie');
  });

  it('does not fetch again after unmount', async () => {
    fetchMock.mockResolvedValue(jsonRes(200, fakeOps));
    const { unmount } = renderHook(() => useQueueOps());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    unmount();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
