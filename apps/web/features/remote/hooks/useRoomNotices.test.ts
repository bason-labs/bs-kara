import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoomNotices } from './useRoomNotices';

// Stable `t`, like the real react-i18next, so effects keyed on it don't re-run every render.
const t = (key: string) => key;
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t }),
}));

type Props = Parameters<typeof useRoomNotices>[0];

function setup(initial: Partial<Props> = {}) {
  const handleLeave = vi.fn();
  const props: Props = {
    roomCode: '1234',
    roomMissing: false,
    lastEndedAt: null,
    handleLeave,
    ...initial,
  };
  const hook = renderHook((p: Props) => useRoomNotices(p), { initialProps: props });
  return { ...hook, props, handleLeave };
}

describe('useRoomNotices', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the room-not-found notice and leaves when the room is missing', () => {
    const { result, handleLeave } = setup({ roomMissing: true });

    expect(result.current).toBe('errors.roomNotFound.message');
    expect(handleLeave).toHaveBeenCalledTimes(1);
  });

  // Mirrors how room data arrives: the hook mounts with the loading default
  // (null), then the first Firebase snapshot carries any historical value.
  it('does not show the end-party notice for a historical lastEndedAt from the first snapshot', () => {
    const { result, rerender, props } = setup({ lastEndedAt: null });

    rerender({ ...props, lastEndedAt: 1_000 });

    expect(result.current).toBeNull();
  });

  it('shows the end-party notice when lastEndedAt moves forward while connected', () => {
    const { result, rerender, props } = setup({ lastEndedAt: null });
    rerender({ ...props, lastEndedAt: 1_000 });

    rerender({ ...props, lastEndedAt: 2_000 });

    expect(result.current).toBe('tv.endPartyNotice');
  });

  it('clears the notice after 4 seconds', () => {
    const { result } = setup({ roomMissing: true });

    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(result.current).toBeNull();
  });
});
