import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoHide } from './useAutoHide';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useAutoHide', () => {
  it('starts visible and hides after delayMs', () => {
    const { result } = renderHook(() => useAutoHide(1000));
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.visible).toBe(false);
  });

  it('bump() flips visible back on and re-arms the timer', () => {
    const { result } = renderHook(() => useAutoHide(500));
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.visible).toBe(false);

    act(() => result.current.bump());
    expect(result.current.visible).toBe(true);

    act(() => vi.advanceTimersByTime(499));
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
  });

  it('window mousemove triggers bump and resets the hide timer', () => {
    const { result } = renderHook(() => useAutoHide(800));
    act(() => vi.advanceTimersByTime(700));
    act(() => {
      window.dispatchEvent(new Event('mousemove'));
    });
    act(() => vi.advanceTimersByTime(700));
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.visible).toBe(false);
  });

  it('removes its window listeners on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useAutoHide(1000));
    unmount();
    const types = remove.mock.calls.map(([t]) => t);
    expect(types).toEqual(expect.arrayContaining(['mousemove', 'touchstart', 'keydown']));
  });
});
