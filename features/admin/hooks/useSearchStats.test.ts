import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchStats } from './useSearchStats';

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

const fakeStats = {
  days: Array.from({ length: 30 }, (_, i) => ({
    date: `202601${String(i + 1).padStart(2, '0')}`,
    total: i,
    live: Math.floor(i / 2),
    cached: i - Math.floor(i / 2),
  })),
};

describe('useSearchStats', () => {
  it('starts in loading state', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSearchStats());
    expect(result.current.loading).toBe(true);
  });

  it('populates data on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, fakeStats));
    const { result } = renderHook(() => useSearchStats());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data).toEqual(fakeStats);
  });

  it('sets error on non-200', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(500, { error: 'internal' }));
    const { result } = renderHook(() => useSearchStats());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.error).toBe('internal');
  });

  it('re-fetches after 60 seconds', async () => {
    fetchMock.mockResolvedValue(jsonRes(200, fakeStats));
    renderHook(() => useSearchStats());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clears interval on unmount', async () => {
    fetchMock.mockResolvedValue(jsonRes(200, fakeStats));
    const { unmount } = renderHook(() => useSearchStats());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
