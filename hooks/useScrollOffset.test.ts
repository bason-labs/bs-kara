import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useScrollOffset } from './useScrollOffset';

function makeScrollEl({
  clientHeight = 600,
  scrollHeight = 10000,
}: { clientHeight?: number; scrollHeight?: number } = {}) {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollTop', { writable: true, value: 0 });
  Object.defineProperty(el, 'clientHeight', { writable: true, value: clientHeight });
  Object.defineProperty(el, 'scrollHeight', { writable: true, value: scrollHeight });
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

    act(() => fireScroll(el, 60));
    expect(result.current.offset).toBe(60);

    act(() => fireScroll(el, 120));
    expect(result.current.offset).toBe(100);

    act(() => fireScroll(el, 250));
    expect(result.current.offset).toBe(100);
  });

  it('reverses on upward scroll and pins to 0 at the top', () => {
    const el = makeScrollEl();
    const { result } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 100));
    expect(result.current.offset).toBe(100);

    act(() => fireScroll(el, 70));
    expect(result.current.offset).toBe(70);

    act(() => fireScroll(el, 0));
    expect(result.current.offset).toBe(0);
  });

  it('snaps to maxOffset after idle when offset is past the midpoint', () => {
    const el = makeScrollEl();
    const { result } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 80));
    expect(result.current.offset).toBe(80);
    expect(result.current.snap).toBe(false);

    act(() => vi.advanceTimersByTime(89));
    expect(result.current.offset).toBe(80);
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

    act(() => fireScroll(el, 100));
    act(() => fireScroll(el, 50));
    expect(result.current.offset).toBe(50);

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
    expect(result.current.snap).toBe(false);
  });

  it('a resumed scroll cancels the pending snap', () => {
    const el = makeScrollEl();
    const { result } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 80));
    act(() => vi.advanceTimersByTime(90));
    expect(result.current.offset).toBe(100);
    expect(result.current.snap).toBe(true);

    act(() => fireScroll(el, 90));
    expect(result.current.snap).toBe(false);
  });

  it('drops sub-threshold scroll deltas without advancing lastY', () => {
    const el = makeScrollEl();
    const { result } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 80));
    expect(result.current.offset).toBe(80);

    // Two micro-jitter ticks — each delta is < 5 vs the un-advanced lastY,
    // so both are dropped.
    act(() => fireScroll(el, 82));
    expect(result.current.offset).toBe(80);
    act(() => fireScroll(el, 84));
    expect(result.current.offset).toBe(80);

    // Cumulative real movement of 6 px (vs lastY still pinned at 80)
    // crosses the threshold and finally registers.
    act(() => fireScroll(el, 86));
    expect(result.current.offset).toBe(86);
  });

  it('freezes the offset while inside the top edge zone', () => {
    const el = makeScrollEl();
    const { result } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 80));
    expect(result.current.offset).toBe(80);

    // y < edgePx (default 50) — the rubber-band guard freezes offset.
    act(() => fireScroll(el, 30));
    expect(result.current.offset).toBe(80);

    // Reaching exact top still pins to 0.
    act(() => fireScroll(el, 0));
    expect(result.current.offset).toBe(0);
  });

  it('freezes the offset while inside the bottom edge zone', () => {
    const el = makeScrollEl({ clientHeight: 500, scrollHeight: 2000 });
    const { result } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 100));
    expect(result.current.offset).toBe(100);

    // y + clientHeight > scrollHeight - edgePx → 1500 + 500 > 1950
    // (true), so the guard freezes the offset despite the big delta.
    act(() => fireScroll(el, 1500));
    expect(result.current.offset).toBe(100);
  });

  it('cleans up listener and timers on unmount', () => {
    const el = makeScrollEl();
    const { result, unmount } = renderUseScrollOffset(el, 100);

    act(() => fireScroll(el, 80));
    expect(result.current.offset).toBe(80);

    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    unmount();
    expect(clearSpy).toHaveBeenCalled();

    fireScroll(el, 120);
    expect(result.current.offset).toBe(80);
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
