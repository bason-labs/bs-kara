import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useYoutubeQuota } from './useYoutubeQuota';
import type { YoutubeQuotaSnapshot } from '@/app/api/admin/quota/youtube/route';

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

const fakeQuota: YoutubeQuotaSnapshot = {
  dailyLimitCalls: 100,
  days: Array.from({ length: 30 }, (_, i) => ({
    date: `202601${String(i + 1).padStart(2, '0')}`,
    calls: i * 2,
  })),
};

describe('useYoutubeQuota', () => {
  it('starts in loading state', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useYoutubeQuota());
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('populates data on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, fakeQuota));
    const { result } = renderHook(() => useYoutubeQuota());

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.data).toEqual(fakeQuota);
    expect(result.current.loading).toBe(false);
  });

  it('sets error on non-200', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(401, { error: 'no_cookie' }));
    const { result } = renderHook(() => useYoutubeQuota());

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.error).toBe('no_cookie');
  });

  it('re-fetches after 60 seconds', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes(200, fakeQuota))
      .mockResolvedValueOnce(jsonRes(200, { ...fakeQuota, dailyLimitCalls: 200 }));

    const { result } = renderHook(() => useYoutubeQuota());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.data?.dailyLimitCalls).toBe(200);
  });

  it('clears the interval on unmount', async () => {
    fetchMock.mockResolvedValue(jsonRes(200, fakeQuota));
    const { unmount } = renderHook(() => useYoutubeQuota());

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    unmount();
    vi.advanceTimersByTime(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
