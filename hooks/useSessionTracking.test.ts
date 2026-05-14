import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionTracking } from './useSessionTracking';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  // Default mock to avoid "Cannot read properties of undefined" when cleanup fires
  fetchMock.mockResolvedValue(jsonRes(200, { ok: true }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useSessionTracking', () => {
  it('does not call join when roomId is null', () => {
    renderHook(() => useSessionTracking(null));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls POST /api/room/join with roomId when roomId is provided', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { sessionId: 'sess-1' }));
    renderHook(() => useSessionTracking('1234'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/room/join',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ roomId: '1234' }),
      }),
    );
  });

  it('calls POST /api/room/leave with sessionId on unmount', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes(200, { sessionId: 'sess-1' }))
      .mockResolvedValueOnce(jsonRes(200, { ok: true }));

    const { unmount } = renderHook(() => useSessionTracking('1234'));
    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/room/leave',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
        body: JSON.stringify({ sessionId: 'sess-1' }),
      }),
    );
  });

  it('does not call leave if join never resolved (no sessionId stored)', async () => {
    fetchMock.mockImplementation(
      (url) =>
        new Promise((resolve) => {
          if (url === '/api/room/join') {
            // never resolves for join
          } else {
            resolve(jsonRes(200, { ok: true }));
          }
        }),
    );
    const { unmount } = renderHook(() => useSessionTracking('1234'));
    unmount();
    // Only the join call was made — leave must NOT be called
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/room/join', expect.anything());
  });

  it('swallows join fetch errors without throwing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    // Should not throw
    const { unmount } = renderHook(() => useSessionTracking('1234'));
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
  });
});
