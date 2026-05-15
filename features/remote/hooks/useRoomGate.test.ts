import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

import { useRouter, useSearchParams } from 'next/navigation';
import { useRoomGate } from './useRoomGate';

const useRouterMock = useRouter as unknown as ReturnType<typeof vi.fn>;
const useSearchParamsMock = useSearchParams as unknown as ReturnType<typeof vi.fn>;

let pushSpy: ReturnType<typeof vi.fn>;
let assignSpy: ReturnType<typeof vi.fn>;
let originalLocation: Location;

function setUrlRoom(room: string | null) {
  useSearchParamsMock.mockReturnValue({
    get: (key: string) => (key === 'room' ? room : null),
  });
}

function stubFetch(response: { allowed: boolean; reason: string }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }),
  );
}

async function flushAsync() {
  await new Promise<void>((r) => setTimeout(r, 0));
}

beforeEach(() => {
  pushSpy = vi.fn();
  useRouterMock.mockReturnValue({ push: pushSpy });
  setUrlRoom(null);

  assignSpy = vi.fn();
  originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    value: { ...window.location, assign: assignSpy },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useRoomGate', () => {
  it('does not call fetch on a fresh load with no room in URL', async () => {
    setUrlRoom(null);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderHook(() => useRoomGate());
    await act(async () => { await flushAsync(); });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('submitJoin navigates when API returns allowed:true', async () => {
    stubFetch({ allowed: true, reason: 'ok' });
    const { result } = renderHook(() => useRoomGate());
    await act(async () => { await result.current.submitJoin('5678'); });
    expect(pushSpy).toHaveBeenCalledWith('/?room=5678');
    expect(result.current.joinError).toBeNull();
  });

  it('submitJoin sets joinError when API returns room_not_found', async () => {
    stubFetch({ allowed: false, reason: 'room_not_found' });
    const { result } = renderHook(() => useRoomGate());
    await act(async () => { await result.current.submitJoin('9999'); });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(result.current.joinError).toBe('room_not_found');
  });

  it('submitJoin sets joinError when API returns subscription_expired', async () => {
    stubFetch({ allowed: false, reason: 'subscription_expired' });
    const { result } = renderHook(() => useRoomGate());
    await act(async () => { await result.current.submitJoin('1234'); });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(result.current.joinError).toBe('subscription_expired');
  });

  it('submitJoin sets joinError when API returns guests_not_allowed', async () => {
    stubFetch({ allowed: false, reason: 'guests_not_allowed' });
    const { result } = renderHook(() => useRoomGate());
    await act(async () => { await result.current.submitJoin('5678'); });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(result.current.joinError).toBe('guests_not_allowed');
  });

  it('submitJoin sets joinError to error on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const { result } = renderHook(() => useRoomGate());
    await act(async () => { await result.current.submitJoin('1234'); });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(result.current.joinError).toBe('error');
  });

  it('submitJoin ignores inputs that are not 4–7 digits', async () => {
    const { result } = renderHook(() => useRoomGate());
    await act(async () => { await result.current.submitJoin('abc'); });
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('handleLeave navigates to / via window.location.assign', async () => {
    setUrlRoom('5678');
    const { result } = renderHook(() => useRoomGate());
    act(() => { result.current.handleLeave(); });
    expect(assignSpy).toHaveBeenCalledWith('/');
  });
});
