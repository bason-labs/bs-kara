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
  claimMock.mockReset().mockResolvedValue('4242');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useRoomGate auto-claim', () => {
  it('fires claimOrGetActiveRoom and replaces into the room on a fresh-load coarse-pointer device', async () => {
    setCoarsePointer(true);
    setUrlRoom(null);

    const { result } = renderHook(() => useRoomGate());
    await act(async () => {
      await flushAsync();
    });

    expect(claimMock).toHaveBeenCalledTimes(1);
    expect(replaceSpy).toHaveBeenCalledWith('/?room=4242');
    expect(result.current.hasExplicitlyLeft).toBe(false);
  });

  it('does not auto-claim on a fine-pointer (desktop) device, regardless of latch', async () => {
    setCoarsePointer(false);
    setUrlRoom(null);

    const { result } = renderHook(() => useRoomGate());
    await act(async () => {
      await flushAsync();
    });

    expect(claimMock).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();

    act(() => result.current.handleLeave());
    await act(async () => {
      await flushAsync();
    });
    expect(claimMock).not.toHaveBeenCalled();
  });
});

describe('useRoomGate handleLeave latch', () => {
  // Regression: tapping Leave on a phone used to immediately bounce the
  // user back into the same room because the auto-claim effect treated
  // "?room= just disappeared from the URL" the same as a fresh page load.
  // After the fix, an explicit Leave latches a ref the effect now checks.
  it('does not auto-claim after handleLeave on a coarse-pointer device', async () => {
    setCoarsePointer(true);
    setUrlRoom('1234');

    const { result, rerender } = renderHook(() => useRoomGate());
    await act(async () => {
      await flushAsync();
    });
    expect(claimMock).not.toHaveBeenCalled();
    expect(result.current.hasExplicitlyLeft).toBe(false);

    act(() => {
      result.current.handleLeave();
    });
    expect(pushSpy).toHaveBeenCalledWith('/');

    // Simulate the URL update that router.push would produce.
    setUrlRoom(null);
    rerender();
    await act(async () => {
      await flushAsync();
    });

    expect(claimMock).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(result.current.hasExplicitlyLeft).toBe(true);
  });

  it('clears the latch when the user opens a fresh ?room= URL, so future Leave still works', async () => {
    setCoarsePointer(true);
    setUrlRoom('1234');

    const { result, rerender } = renderHook(() => useRoomGate());
    await act(async () => {
      await flushAsync();
    });

    // First Leave latches, then they sit on /.
    act(() => {
      result.current.handleLeave();
    });
    setUrlRoom(null);
    rerender();
    await act(async () => {
      await flushAsync();
    });
    expect(result.current.hasExplicitlyLeft).toBe(true);

    // User scans a new QR — URL gets a fresh ?room=.
    setUrlRoom('5678');
    rerender();
    await act(async () => {
      await flushAsync();
    });
    expect(result.current.hasExplicitlyLeft).toBe(false);

    // A second Leave from the new room latches again — sticky state from
    // the first Leave didn't carry over.
    act(() => {
      result.current.handleLeave();
    });
    setUrlRoom(null);
    rerender();
    await act(async () => {
      await flushAsync();
    });
    expect(claimMock).not.toHaveBeenCalled();
    expect(result.current.hasExplicitlyLeft).toBe(true);
  });
});
