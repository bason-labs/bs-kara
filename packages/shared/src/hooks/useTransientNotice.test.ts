import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransientNotice } from './useTransientNotice';

describe('useTransientNotice', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts with notice = null', () => {
    const { result } = renderHook(() => useTransientNotice(1000));
    expect(result.current.notice).toBeNull();
  });

  it('show(msg) sets the notice and clears it after durationMs', () => {
    const { result } = renderHook(() => useTransientNotice(1000));

    act(() => result.current.show('hello'));
    expect(result.current.notice).toBe('hello');

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current.notice).toBe('hello');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.notice).toBeNull();
  });

  it('a second show() resets the timer (does not clip)', () => {
    const { result } = renderHook(() => useTransientNotice(1000));

    act(() => result.current.show('first'));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.notice).toBe('first');

    // Second call before the first timer fires must reset, not clip.
    act(() => result.current.show('second'));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    // 1600ms total since the first call; only 800ms since the second.
    // The first timer must have been cancelled, so we still see 'second'.
    expect(result.current.notice).toBe('second');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.notice).toBeNull();
  });

  it('cleans up its pending timer on unmount', () => {
    const { result, unmount } = renderHook(() => useTransientNotice(1000));
    act(() => result.current.show('bye'));
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
