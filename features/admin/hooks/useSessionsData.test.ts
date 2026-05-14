import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionsData } from './useSessionsData';

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

const fakeSessions = {
  sessions: [
    {
      sessionId: 's1',
      ip: '1.2.3.4',
      userAgent: 'UA',
      deviceType: 'mobile',
      roomId: '1234',
      joinedAt: 1000,
      leftAt: null,
    },
  ],
};

describe('useSessionsData', () => {
  it('starts in loading state', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSessionsData());
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('populates data on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, fakeSessions));
    const { result } = renderHook(() => useSessionsData());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data).toEqual(fakeSessions);
    expect(result.current.loading).toBe(false);
  });

  it('sets error on non-200', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(401, { error: 'no_cookie' }));
    const { result } = renderHook(() => useSessionsData());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.error).toBe('no_cookie');
  });

  it('re-fetches after 30 seconds', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes(200, fakeSessions))
      .mockResolvedValueOnce(jsonRes(200, { sessions: [] }));
    const { result } = renderHook(() => useSessionsData());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.data?.sessions).toEqual([]);
  });

  it('clears interval on unmount', async () => {
    fetchMock.mockResolvedValue(jsonRes(200, fakeSessions));
    const { unmount } = renderHook(() => useSessionsData());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
