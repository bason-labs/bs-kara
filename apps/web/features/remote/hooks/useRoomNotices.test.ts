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
    roomLoaded: false,
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

  // Mirrors how useRoom delivers data: the hook mounts before the first
  // snapshot (roomLoaded=false, lastEndedAt=null), then the snapshot lands.
  it('does not show the end-party notice for a historical lastEndedAt from the first snapshot', () => {
    const { result, rerender, props } = setup();

    rerender({ ...props, roomLoaded: true, lastEndedAt: 1_000 });

    expect(result.current).toBeNull();
  });

  it('shows the end-party notice when lastEndedAt moves forward while connected', () => {
    const { result, rerender, props } = setup();
    rerender({ ...props, roomLoaded: true, lastEndedAt: 1_000 });

    rerender({ ...props, roomLoaded: true, lastEndedAt: 2_000 });

    expect(result.current).toBe('tv.endPartyNotice');
  });

  // Regression: the "reset on room change" effect ran after the seeding effect on
  // mount, wiping the seed. In a room that had never ended, lastEndedAt stayed null
  // through loading so the seed was never re-taken, and the first End Party was
  // swallowed as the seed: phones never showed the toast.
  it('shows the end-party notice the first time a never-ended room is ended', () => {
    const { result, rerender, props } = setup();
    rerender({ ...props, roomLoaded: true, lastEndedAt: null });

    rerender({ ...props, roomLoaded: true, lastEndedAt: 5_000 });

    expect(result.current).toBe('tv.endPartyNotice');
  });

  it('does not replay the previous room\'s history when switching rooms', () => {
    const { result, rerender, props } = setup({ roomCode: '1111' });
    rerender({ ...props, roomCode: '1111', roomLoaded: true, lastEndedAt: 1_000 });

    // useRoom briefly renders the new code with the old room's data, then resets.
    rerender({ ...props, roomCode: '2222', roomLoaded: true, lastEndedAt: 1_000 });
    rerender({ ...props, roomCode: '2222', roomLoaded: false, lastEndedAt: null });
    rerender({ ...props, roomCode: '2222', roomLoaded: true, lastEndedAt: 3_000 });

    expect(result.current).toBeNull();
  });

  it('clears the notice after 4 seconds', () => {
    const { result } = setup({ roomMissing: true });

    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(result.current).toBeNull();
  });
});
