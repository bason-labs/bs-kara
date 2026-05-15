import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@/lib/registeredUsers', () => ({
  lookupUserByCode: vi.fn(),
}));

import { useRouter, useSearchParams } from 'next/navigation';
import { lookupUserByCode } from '@/lib/registeredUsers';
import { useRoomGate } from './useRoomGate';

const useRouterMock = useRouter as unknown as ReturnType<typeof vi.fn>;
const useSearchParamsMock = useSearchParams as unknown as ReturnType<typeof vi.fn>;
const lookupMock = lookupUserByCode as unknown as ReturnType<typeof vi.fn>;

let pushSpy: ReturnType<typeof vi.fn>;
let assignSpy: ReturnType<typeof vi.fn>;
let originalLocation: Location;

function setUrlRoom(room: string | null) {
  useSearchParamsMock.mockReturnValue({
    get: (key: string) => (key === 'room' ? room : null),
  });
}

async function flushAsync() {
  await new Promise<void>((r) => setTimeout(r, 0));
}

beforeEach(() => {
  pushSpy = vi.fn();
  useRouterMock.mockReturnValue({ push: pushSpy });
  setUrlRoom(null);
  lookupMock.mockReset();

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
  vi.clearAllMocks();
});

describe('useRoomGate', () => {
  it('does not attempt any lookup on a fresh load with no room in URL', async () => {
    setUrlRoom(null);
    renderHook(() => useRoomGate());
    await act(async () => { await flushAsync(); });
    expect(lookupMock).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('submitJoin navigates when code is a valid registered room', async () => {
    lookupMock.mockResolvedValue({ roomCode: '5678', suspended: false });
    const { result } = renderHook(() => useRoomGate());
    await act(async () => {
      await result.current.submitJoin('5678');
    });
    expect(pushSpy).toHaveBeenCalledWith('/?room=5678');
    expect(result.current.joinError).toBeNull();
  });

  it('submitJoin sets joinError when code is not registered', async () => {
    lookupMock.mockResolvedValue(null);
    const { result } = renderHook(() => useRoomGate());
    await act(async () => {
      await result.current.submitJoin('9999');
    });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(result.current.joinError).toBe('notFound');
  });

  it('submitJoin sets joinError when room is suspended', async () => {
    lookupMock.mockResolvedValue({ roomCode: '5678', suspended: true });
    const { result } = renderHook(() => useRoomGate());
    await act(async () => {
      await result.current.submitJoin('5678');
    });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(result.current.joinError).toBe('suspended');
  });

  it('submitJoin ignores inputs that are not 4–7 digits', async () => {
    const { result } = renderHook(() => useRoomGate());
    await act(async () => {
      await result.current.submitJoin('abc');
    });
    expect(lookupMock).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('handleLeave navigates to / via window.location.assign', async () => {
    setUrlRoom('5678');
    const { result } = renderHook(() => useRoomGate());
    act(() => { result.current.handleLeave(); });
    expect(assignSpy).toHaveBeenCalledWith('/');
  });
});
