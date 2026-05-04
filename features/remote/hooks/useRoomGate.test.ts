import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@/lib/activeRoom', () => ({
  claimOrGetActiveRoom: vi.fn(),
  subscribeActiveRoom: vi.fn(() => () => {}),
}));

import { useRouter, useSearchParams } from 'next/navigation';
import { claimOrGetActiveRoom } from '@/lib/activeRoom';
import { useRoomGate } from './useRoomGate';

const useRouterMock = useRouter as unknown as ReturnType<typeof vi.fn>;
const useSearchParamsMock = useSearchParams as unknown as ReturnType<typeof vi.fn>;
const claimMock = claimOrGetActiveRoom as unknown as ReturnType<typeof vi.fn>;

let pushSpy: ReturnType<typeof vi.fn>;
let replaceSpy: ReturnType<typeof vi.fn>;
let assignSpy: ReturnType<typeof vi.fn>;
let originalLocation: Location;

function setUrlRoom(room: string | null) {
  useSearchParamsMock.mockReturnValue({
    get: (key: string) => (key === 'room' ? room : null),
  });
}

function setCoarsePointer(coarse: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: coarse,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

async function flushAsync() {
  await new Promise<void>((r) => setTimeout(r, 0));
}

beforeEach(() => {
  pushSpy = vi.fn();
  replaceSpy = vi.fn();
  useRouterMock.mockReturnValue({ push: pushSpy, replace: replaceSpy });
  setUrlRoom(null);
  setCoarsePointer(false);
  claimMock.mockReset();

  // handleLeave now does a hard reload via window.location.assign('/').
  // Stash the real Location and substitute one whose assign is spyable;
  // afterEach restores the original.
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
  // Joining a room is always an explicit user gesture (scan the TV QR, tap
  // "Tham gia phòng đang mở", or enter the OTP). An earlier version
  // auto-claimed on coarse-pointer fresh loads, which made tapping Leave
  // visually do nothing — the same effect re-claimed the still-live TV
  // room within milliseconds and bounced the user back inside.
  it('does not call claimOrGetActiveRoom on a fresh-load coarse-pointer device', async () => {
    setCoarsePointer(true);
    setUrlRoom(null);

    renderHook(() => useRoomGate());
    await act(async () => {
      await flushAsync();
    });

    expect(claimMock).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('does not call claimOrGetActiveRoom on a fresh-load fine-pointer device', async () => {
    setCoarsePointer(false);
    setUrlRoom(null);

    renderHook(() => useRoomGate());
    await act(async () => {
      await flushAsync();
    });

    expect(claimMock).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  // Regression: this exact sequence used to silently re-enter the room
  // within a few ms because of the coarse-pointer auto-claim effect that
  // has since been removed. The bug was reported as "tapping Leave on
  // mobile does nothing".
  it('handleLeave on a coarse-pointer device navigates to / without invoking any claim', async () => {
    setCoarsePointer(true);
    setUrlRoom('1234');

    const { result, rerender } = renderHook(() => useRoomGate());
    await act(async () => {
      await flushAsync();
    });
    expect(claimMock).not.toHaveBeenCalled();

    act(() => {
      result.current.handleLeave();
    });
    expect(assignSpy).toHaveBeenCalledWith('/');
    expect(pushSpy).not.toHaveBeenCalled();

    // Simulate the URL update that the hard reload would produce.
    setUrlRoom(null);
    rerender();
    await act(async () => {
      await flushAsync();
    });

    expect(claimMock).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});
