import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOutroControls } from './useOutroControls';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useOutroControls', () => {
  it('starts hidden and stays hidden when outro is not active', () => {
    const { result } = renderHook(({ active }) => useOutroControls(active), {
      initialProps: { active: false },
    });
    expect(result.current.visible).toBe(false);
    act(() => result.current.handleMouseEnter());
    act(() => result.current.handlePointerDown({ pointerType: 'mouse' }));
    act(() => result.current.handleFocusIn());
    expect(result.current.visible).toBe(false);
  });

  it('mouseenter shows controls and mouseleave hides immediately', () => {
    const { result } = renderHook(() => useOutroControls(true));
    expect(result.current.visible).toBe(false);
    act(() => result.current.handleMouseEnter());
    expect(result.current.visible).toBe(true);
    act(() => result.current.handleMouseLeave());
    expect(result.current.visible).toBe(false);
  });

  it('touch tap shows controls and auto-hides after ~2s', () => {
    const { result } = renderHook(() => useOutroControls(true));
    act(() => result.current.handlePointerDown({ pointerType: 'touch' }));
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(1999));
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
  });

  it('mouse click does NOT arm the auto-hide timer (mouseleave handles it)', () => {
    const { result } = renderHook(() => useOutroControls(true));
    act(() => result.current.handleMouseEnter());
    act(() => result.current.handlePointerDown({ pointerType: 'mouse' }));
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(5000));
    // Without a mouseleave the controls remain visible — mouse hover is the
    // dwell signal, not a 2s timer.
    expect(result.current.visible).toBe(true);
  });

  it('focusing a control shows the buttons even if the mouse is elsewhere', () => {
    const { result } = renderHook(() => useOutroControls(true));
    expect(result.current.visible).toBe(false);
    act(() => result.current.handleFocusIn());
    expect(result.current.visible).toBe(true);
  });

  it('repeated taps reset the auto-hide window so the user is not cut off mid-interaction', () => {
    const { result } = renderHook(() => useOutroControls(true));
    act(() => result.current.handlePointerDown({ pointerType: 'touch' }));
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.visible).toBe(true);
    // Second tap before the first timer expires.
    act(() => result.current.handlePointerDown({ pointerType: 'touch' }));
    act(() => vi.advanceTimersByTime(1500));
    // Original 2000ms would have expired by now (1500 + 1500); the reset
    // window keeps the controls up.
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.visible).toBe(false);
  });

  it('flipping outro off resets visible and clears any pending auto-hide', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useOutroControls(active),
      { initialProps: { active: true } },
    );
    act(() => result.current.handlePointerDown({ pointerType: 'touch' }));
    expect(result.current.visible).toBe(true);
    rerender({ active: false });
    expect(result.current.visible).toBe(false);
    // Pending timer should not fire a stale setVisible.
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.visible).toBe(false);
  });
});
