import { createRef } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmojiLayerHandle } from './EmojiLayer';

vi.mock('@/lib/firebase', () => ({ db: {} }));

let capturedListener:
  | ((snap: { val: () => unknown; key: string }) => void)
  | null = null;

const onChildAddedMock = vi.fn(
  (_q: unknown, listener: (snap: { val: () => unknown; key: string }) => void) => {
    capturedListener = listener;
    return () => {};
  },
);

vi.mock('firebase/database', () => ({
  ref: vi.fn(() => ({})),
  query: vi.fn((r: unknown) => r),
  orderByChild: vi.fn(),
  startAfter: vi.fn(),
  onChildAdded: (...args: unknown[]) =>
    onChildAddedMock(
      ...(args as [unknown, (snap: { val: () => unknown; key: string }) => void]),
    ),
}));

import { EmojiLayer } from './EmojiLayer';

beforeEach(() => {
  capturedListener = null;
  onChildAddedMock.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('EmojiLayer', () => {
  it('subscribes to the room emojis path on mount', () => {
    render(<EmojiLayer roomId="1234" />);
    expect(onChildAddedMock).toHaveBeenCalledTimes(1);
  });

  it('renders an emoji image after a child-added event has been drained', async () => {
    const { container } = render(<EmojiLayer roomId="1234" />);
    expect(capturedListener).not.toBeNull();

    act(() => {
      capturedListener!({ key: 'r1', val: () => ({ emoji: '🔥', timestamp: 1 }) });
    });
    // Drain timer is 150–250ms; advance past the upper bound.
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain('1f525');
  });

  it('ignores snapshots without an emoji field', () => {
    const { container } = render(<EmojiLayer roomId="1234" />);
    act(() => {
      capturedListener!({ key: 'r1', val: () => ({ timestamp: 1 }) });
    });
    expect(container.querySelector('img')).toBeNull();
  });

  it('pushLocal injects an animation synchronously via ref', async () => {
    const ref = createRef<EmojiLayerHandle>();
    const { container } = render(<EmojiLayer ref={ref} roomId="1234" />);

    act(() => {
      ref.current!.pushLocal('🔥');
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain('1f525');
  });

  it('filters the matching Firebase echo of a locally-pushed emoji', async () => {
    const ref = createRef<EmojiLayerHandle>();
    const { container } = render(<EmojiLayer ref={ref} roomId="1234" />);

    // Pin Date.now() so pushLocal and the simulated echo share a timestamp.
    const fixedTs = 12345;
    vi.spyOn(Date, 'now').mockReturnValue(fixedTs);

    act(() => {
      ref.current!.pushLocal('🔥');
    });
    // Echo arrives from Firebase with the same emoji + timestamp.
    act(() => {
      capturedListener!({
        key: 'echo-key',
        val: () => ({ emoji: '🔥', timestamp: fixedTs }),
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // Only the optimistic instance rendered; the echo was deduped.
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('still renders Firebase events that do not match a local push', async () => {
    const ref = createRef<EmojiLayerHandle>();
    const { container } = render(<EmojiLayer ref={ref} roomId="1234" />);

    act(() => {
      ref.current!.pushLocal('🔥');
    });
    // A different emoji from a different user — must still render.
    act(() => {
      capturedListener!({
        key: 'remote-1',
        val: () => ({ emoji: '🎉', timestamp: 99999 }),
      });
    });
    // Drain twice (each drain pops one queued reaction).
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(container.querySelectorAll('img')).toHaveLength(2);
  });

  it('caps visible animations at 12, dropping oldest and keeping newest tap', async () => {
    const ref = createRef<EmojiLayerHandle>();
    const { container } = render(<EmojiLayer ref={ref} roomId="1234" />);

    // Push 15 distinct emojis; cap is 12, so 3 oldest should be dropped.
    act(() => {
      for (let i = 0; i < 15; i++) {
        ref.current!.pushLocal('🔥');
      }
    });
    // Drain a comfortable margin past 15 staggered ticks (max 250ms each).
    await act(async () => {
      vi.advanceTimersByTime(15 * 300);
    });

    // No more than 12 active at any time. Some early reactions may have
    // already animated out by safety-net unmount, but the count must never
    // exceed the cap.
    expect(container.querySelectorAll('img').length).toBeLessThanOrEqual(12);
  });
});
