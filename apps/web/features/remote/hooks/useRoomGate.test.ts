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

  it('submitJoin navigates once the code is allowed', async () => {
    stubFetch({ allowed: true, reason: 'ok' });
    const { result } = renderHook(() => useRoomGate());
    await act(async () => { result.current.submitJoin('5678'); await flushAsync(); });
    expect(pushSpy).toHaveBeenCalledWith('/?room=5678');
    expect(result.current.joinError).toBeNull();
  });

  it.each(['room_not_found', 'subscription_expired'])('submitJoin shows %s and stays on the form', async (reason) => {
    stubFetch({ allowed: false, reason });
    const { result } = renderHook(() => useRoomGate());
    await act(async () => { result.current.submitJoin('9999'); await flushAsync(); });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(result.current.joinError).toBe(reason);
    expect(result.current.isJoining).toBe(false);
  });

  it('submitJoin ignores inputs that are not 4–7 digits', async () => {
    const { result } = renderHook(() => useRoomGate());
    await act(async () => { result.current.submitJoin('abc'); await flushAsync(); });
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('does not enter a room from the URL (host link, QR) when its subscription has expired', async () => {
    setUrlRoom('4489');
    stubFetch({ allowed: false, reason: 'subscription_expired' });
    const { result } = renderHook(() => useRoomGate());
    expect(result.current.isCheckingRoom).toBe(true);
    expect(result.current.roomCode).toBeNull();
    await act(async () => { await flushAsync(); });
    expect(result.current.roomCode).toBeNull();
    expect(result.current.blockedReason).toBe('subscription_expired');
  });

  it.each([
    ['allowed', { ok: true, status: 200, json: async () => ({ allowed: true, reason: 'ok' }) }],
    ['server error (fails open)', { ok: false, status: 503, json: async () => ({ allowed: false, reason: 'room_not_found' }) }],
  ])('enters the URL room when the check is %s', async (_label, response) => {
    setUrlRoom('4489');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    const { result } = renderHook(() => useRoomGate());
    await act(async () => { await flushAsync(); });
    expect(result.current.roomCode).toBe('4489');
    expect(result.current.blockedReason).toBeNull();
  });

  it('handleLeave navigates to / via window.location.assign', async () => {
    setUrlRoom('5678');
    stubFetch({ allowed: true, reason: 'ok' });
    const { result } = renderHook(() => useRoomGate());
    act(() => { result.current.handleLeave(); });
    expect(assignSpy).toHaveBeenCalledWith('/');
  });
});
