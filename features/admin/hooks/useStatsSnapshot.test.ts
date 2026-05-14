import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStatsSnapshot } from './useStatsSnapshot';
import type { StatsSnapshot } from '@/app/api/admin/stats/route';

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

const fakeSnapshot: StatsSnapshot = {
  totalRooms: 2,
  activeTvRooms: 1,
  totalQueueDepth: 3,
  rooms: [],
};

describe('useStatsSnapshot', () => {
  it('starts in loading state', () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useStatsSnapshot());
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('populates data on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, fakeSnapshot));
    const { result } = renderHook(() => useStatsSnapshot());

    // Flush microtasks for the initial fetch without advancing the 30s interval
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(fakeSnapshot);
    expect(result.current.error).toBeNull();
  });

  it('sets error on non-200 response', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(500, { error: 'internal' }));
    const { result } = renderHook(() => useStatsSnapshot());

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.error).toBe('internal');
    expect(result.current.data).toBeNull();
  });

  it('sets error on network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('net::ERR_FAILED'));
    const { result } = renderHook(() => useStatsSnapshot());

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.error).toBe('net::ERR_FAILED');
  });

  it('does not fetch again after unmount', async () => {
    fetchMock.mockResolvedValue(jsonRes(200, fakeSnapshot));
    const { unmount } = renderHook(() => useStatsSnapshot());

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    unmount();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
