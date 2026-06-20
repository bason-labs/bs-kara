import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(),
  ref: vi.fn(() => ({})),
  get: getDbMock,
}));

import { renderHook, act } from '@testing-library/react';
import { useInactivityTimeout } from './useInactivityTimeout';

const STORAGE_KEY = 'karaoke_last_active';

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  getDbMock.mockResolvedValue({ exists: () => false, val: () => null });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useInactivityTimeout', () => {
  it('timedOut is false initially', () => {
    const { result } = renderHook(() => useInactivityTimeout('1234'));
    expect(result.current.timedOut).toBe(false);
  });

  it('timedOut becomes true after default 60 min of inactivity', async () => {
    const { result } = renderHook(() => useInactivityTimeout('1234'));
    sessionStorage.setItem(STORAGE_KEY, String(Date.now() - 61 * 60 * 1000));
    await act(async () => { vi.advanceTimersByTime(61_000); });
    expect(result.current.timedOut).toBe(true);
  });

  it('resetActivity resets timedOut to false', async () => {
    const { result } = renderHook(() => useInactivityTimeout('1234'));
    sessionStorage.setItem(STORAGE_KEY, String(Date.now() - 61 * 60 * 1000));
    await act(async () => { vi.advanceTimersByTime(61_000); });
    expect(result.current.timedOut).toBe(true);
    act(() => { result.current.resetActivity(); });
    expect(result.current.timedOut).toBe(false);
  });

  it('does not time out within the timeout window', async () => {
    const { result } = renderHook(() => useInactivityTimeout('1234'));
    sessionStorage.setItem(STORAGE_KEY, String(Date.now() - 30 * 60 * 1000));
    await act(async () => { vi.advanceTimersByTime(61_000); });
    expect(result.current.timedOut).toBe(false);
  });

  it('rejoin clears timedOut when API returns allowed:true', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true, reason: 'ok' }),
    });
    const { result } = renderHook(() => useInactivityTimeout('1234'));
    sessionStorage.setItem(STORAGE_KEY, String(Date.now() - 61 * 60 * 1000));
    await act(async () => { vi.advanceTimersByTime(61_000); });
    let rejoinResult: { ok: boolean; reason: string } | undefined;
    await act(async () => { rejoinResult = await result.current.rejoin(); });
    expect(rejoinResult?.ok).toBe(true);
    expect(result.current.timedOut).toBe(false);
  });

  it('rejoin returns false + reason when API returns guests_not_allowed', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: false, reason: 'guests_not_allowed' }),
    });
    const { result } = renderHook(() => useInactivityTimeout('1234'));
    let rejoinResult: { ok: boolean; reason: string } | undefined;
    await act(async () => { rejoinResult = await result.current.rejoin(); });
    expect(rejoinResult?.ok).toBe(false);
    expect(rejoinResult?.reason).toBe('guests_not_allowed');
    expect(result.current.timedOut).toBe(true);
  });

  it('shows timedOut immediately on mount when session is already expired', async () => {
    // Pre-populate storage with a stale timestamp so the on-mount check fires
    sessionStorage.setItem(STORAGE_KEY, String(Date.now() - 61 * 60 * 1000));
    const { result } = renderHook(() => useInactivityTimeout('1234'));
    await act(async () => {}); // flush effects
    expect(result.current.timedOut).toBe(true);
  });

  it('is inactive when roomCode is null', async () => {
    const { result } = renderHook(() => useInactivityTimeout(null));
    sessionStorage.setItem(STORAGE_KEY, String(Date.now() - 61 * 60 * 1000));
    await act(async () => { vi.advanceTimersByTime(61_000); });
    expect(result.current.timedOut).toBe(false);
  });
});
