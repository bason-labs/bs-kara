import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firebase database is only touched inside claim/release callbacks (not in
// render), so a thin stub is enough for the id-stability assertions.
vi.mock('firebase/database', () => ({
  onDisconnect: vi.fn(() => ({ set: vi.fn() })),
  ref: vi.fn(() => ({})),
  runTransaction: vi.fn(async () => ({ committed: false })),
}));

vi.mock('@bs-kara/shared', () => ({
  db: {},
  getRoomDataPath: (roomId: string) => `rooms/${roomId}`,
}));

import { renderHook } from '@testing-library/react';
import { useFullscreenOwnership } from './useFullscreenOwnership';

describe('useFullscreenOwnership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Locks the lazy-useState refactor of the device id: the id must be created
  // once and survive re-renders within the same hook instance. Before the
  // refactor this lived in a ref read during render; the regression we guard
  // against is a fresh id on every render (which would break the
  // claim/release transaction identity used to own the fullscreen lock).
  it('returns a stable device id across re-renders', () => {
    const { result, rerender } = renderHook(() => useFullscreenOwnership('1234'));
    const first = result.current.deviceId;
    rerender();
    rerender();
    expect(result.current.deviceId).toBe(first);
    expect(first).toBeTruthy();
  });

  it('returns the same device id when the roomId prop changes', () => {
    const { result, rerender } = renderHook(
      ({ room }: { room: string | null }) => useFullscreenOwnership(room),
      { initialProps: { room: '1234' as string | null } },
    );
    const first = result.current.deviceId;
    rerender({ room: '5678' });
    expect(result.current.deviceId).toBe(first);
  });

  it('gives separate hook instances distinct device ids', () => {
    const a = renderHook(() => useFullscreenOwnership('1234'));
    const b = renderHook(() => useFullscreenOwnership('1234'));
    expect(a.result.current.deviceId).not.toBe(b.result.current.deviceId);
  });
});
