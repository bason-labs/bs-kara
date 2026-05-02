import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useScrollOffset } from './useScrollOffset';

function makeScrollEl() {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollTop', { writable: true, value: 0 });
  document.body.appendChild(el);
  return el;
}

function fireScroll(el: HTMLElement, y: number) {
  (el as unknown as { scrollTop: number }).scrollTop = y;
  el.dispatchEvent(new Event('scroll'));
}

function renderUseScrollOffset(el: HTMLElement, maxOffset: number) {
  return renderHook(() => {
    const ref = useRef<HTMLElement | null>(el);
    return useScrollOffset(ref, maxOffset);
  });
}

describe('useScrollOffset', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts at offset=0 with snap=false', () => {
    const el = makeScrollEl();
    const { result } = renderUseScrollOffset(el, 100);
    expect(result.current.offset).toBe(0);
    expect(result.current.snap).toBe(false);
  });

  it('accumulates the scroll delta downward, clamped to maxOffset', () => {
    const el = makeScrollEl();
    const { result } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 30));
    expect(result.current.offset).toBe(30);

    act(() => fireScroll(el, 80));
    expect(result.current.offset).toBe(80);

    act(() => fireScroll(el, 250));
    expect(result.current.offset).toBe(100);
  });

  it('reverses on upward scroll and pins to 0 at the top', () => {
    const el = makeScrollEl();
    const { result } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 80));
    expect(result.current.offset).toBe(80);

    act(() => fireScroll(el, 30));
    expect(result.current.offset).toBe(30);

    act(() => fireScroll(el, 0));
    expect(result.current.offset).toBe(0);
  });

  it('snaps to maxOffset after idle when offset is past the midpoint', () => {
    const el = makeScrollEl();
    const { result } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 60));
    expect(result.current.offset).toBe(60);
    expect(result.current.snap).toBe(false);

    act(() => vi.advanceTimersByTime(89));
    expect(result.current.offset).toBe(60);
    expect(result.current.snap).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.offset).toBe(100);
    expect(result.current.snap).toBe(true);

    act(() => vi.advanceTimersByTime(180));
    expect(result.current.snap).toBe(false);
  });

  it('snaps to 0 after idle when offset is at or before the midpoint', () => {
    const el = makeScrollEl();
    const { result } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 60));
    act(() => fireScroll(el, 40));
    expect(result.current.offset).toBe(40);

    act(() => vi.advanceTimersByTime(90));
    expect(result.current.offset).toBe(0);
    expect(result.current.snap).toBe(true);
  });

  it('does not flip `snap` when scroll ends already at an endpoint', () => {
    const el = makeScrollEl();
    const { result } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 200));
    expect(result.current.offset).toBe(100);

    act(() => vi.advanceTimersByTime(90));
    // Already at maxOffset, so no transition is needed.
    expect(result.current.snap).toBe(false);
  });

  it('a resumed scroll cancels the pending snap', () => {
    const el = makeScrollEl();
    const { result } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 60));
    act(() => vi.advanceTimersByTime(90));
    expect(result.current.offset).toBe(100);
    expect(result.current.snap).toBe(true);

    // Mid-snap, the user grabs the scroller again — snap must turn off so
    // the next frame's transform is gesture-coupled, not eased.
    act(() => fireScroll(el, 70));
    expect(result.current.snap).toBe(false);
  });

  it('cleans up listener and timers on unmount', () => {
    const el = makeScrollEl();
    const { result, unmount } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 50));
    expect(result.current.offset).toBe(50);

    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    unmount();
    expect(clearSpy).toHaveBeenCalled();

    fireScroll(el, 80);
    expect(result.current.offset).toBe(50);
  });

  it('re-clamps a stale offset when maxOffset shrinks', () => {
    const el = makeScrollEl();
    const { result, rerender } = renderHook(
      ({ max }: { max: number }) => {
        const ref = useRef<HTMLElement | null>(el);
        return useScrollOffset(ref, max);
      },
      { initialProps: { max: 200 } },
    );

    act(() => fireScroll(el, 150));
    expect(result.current.offset).toBe(150);

    rerender({ max: 80 });
    expect(result.current.offset).toBe(80);
  });
});
