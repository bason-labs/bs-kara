import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/firebase', () => ({ db: {} }));

let capturedListener:
  | ((snap: { val: () => unknown; key: string }) => void)
  | null = null;

const onChildAddedMock = vi.fn(
  (
    _q: unknown,
    listener: (snap: { val: () => unknown; key: string }) => void,
  ) => {
    capturedListener = listener;
    return () => {};
  },
);

const refMock = vi.fn((db: unknown, path: string) => ({ db, path }));
const queryMock = vi.fn((target: unknown) => target);
const orderByChildMock = vi.fn((key: string) => ({ orderByChild: key }));
const startAfterMock = vi.fn((value: unknown) => ({ startAfter: value }));

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(),
  ref: (db: unknown, path: string) => refMock(db, path),
  query: (target: unknown, ...mods: unknown[]) =>
    queryMock(target, ...(mods as [])),
  orderByChild: (key: string) => orderByChildMock(key),
  startAfter: (value: unknown) => startAfterMock(value),
  onChildAdded: (
    q: unknown,
    listener: (snap: { val: () => unknown; key: string }) => void,
  ) => onChildAddedMock(q, listener),
}));

import { useSongScore } from '@/hooks/useSongScore';

beforeEach(() => {
  capturedListener = null;
  onChildAddedMock.mockClear();
  refMock.mockClear();
  startAfterMock.mockClear();
  orderByChildMock.mockClear();
});

describe('useSongScore', () => {
  it('returns null and does NOT subscribe when enabled is false', () => {
    const { result } = renderHook(() => useSongScore('R1', 'song-1', false));
    expect(result.current).toBeNull();
    expect(onChildAddedMock).not.toHaveBeenCalled();
  });

  it('returns null and does NOT subscribe when currentSongId is null', () => {
    const { result } = renderHook(() => useSongScore('R1', null, true));
    expect(result.current).toBeNull();
    expect(onChildAddedMock).not.toHaveBeenCalled();
  });

  it('subscribes once and reports state 0 on initial mount', () => {
    const { result } = renderHook(() => useSongScore('R1', 'song-1', true));
    expect(onChildAddedMock).toHaveBeenCalledTimes(1);
    expect(result.current?.state).toBe(0);
    expect(result.current?.value).toBe(0);
    // The Firebase query was anchored via startAfter — pinned timestamp
    // semantics, not a re-stream of historical reactions.
    expect(startAfterMock).toHaveBeenCalledTimes(1);
  });

  it('transitions to state 1 after one fire reaction (sum 1.5 < threshold)', () => {
    const { result } = renderHook(() => useSongScore('R1', 'song-1', true));
    act(() => {
      capturedListener!({
        key: 'r1',
        val: () => ({ emoji: '🔥', timestamp: Date.now() + 1 }),
      });
    });
    expect(result.current?.state).toBe(1);
  });

  it('transitions to state 2 after three fire reactions (sum 4.5 ≥ threshold)', () => {
    const { result } = renderHook(() => useSongScore('R1', 'song-1', true));
    const ts = Date.now() + 1;
    act(() => {
      capturedListener!({
        key: 'r1',
        val: () => ({ emoji: '🔥', timestamp: ts }),
      });
      capturedListener!({
        key: 'r2',
        val: () => ({ emoji: '🔥', timestamp: ts + 1 }),
      });
      capturedListener!({
        key: 'r3',
        val: () => ({ emoji: '🔥', timestamp: ts + 2 }),
      });
    });
    expect(result.current?.state).toBe(2);
    expect(result.current?.value).toBeGreaterThan(0);
  });

  it('resets reactions back to state 0 when currentSongId changes', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useSongScore('R1', id, true),
      { initialProps: { id: 'song-A' } },
    );
    act(() => {
      capturedListener!({
        key: 'r1',
        val: () => ({ emoji: '🔥', timestamp: 1 }),
      });
      capturedListener!({
        key: 'r2',
        val: () => ({ emoji: '🔥', timestamp: 2 }),
      });
      capturedListener!({
        key: 'r3',
        val: () => ({ emoji: '🔥', timestamp: 3 }),
      });
    });
    expect(result.current?.state).toBe(2);

    rerender({ id: 'song-B' });
    expect(result.current?.state).toBe(0);
  });

  it('skips snapshots whose emoji field is missing or non-string', () => {
    const { result } = renderHook(() => useSongScore('R1', 'song-1', true));
    act(() => {
      capturedListener!({ key: 'r1', val: () => ({ timestamp: 1 }) });
      capturedListener!({ key: 'r2', val: () => null });
      capturedListener!({
        key: 'r3',
        val: () => ({ emoji: 42, timestamp: 2 }),
      });
    });
    expect(result.current?.state).toBe(0);
  });
});
