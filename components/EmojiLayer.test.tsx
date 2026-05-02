import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
});
