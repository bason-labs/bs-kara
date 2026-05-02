import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMCKickPlay } from './useMCKickPlay';

describe('useMCKickPlay', () => {
  it('calls setPlaying(true) on the gated → ungated edge when not already playing', () => {
    const setPlaying = vi.fn();
    const { rerender } = renderHook(
      ({ gated, playing }: { gated: boolean; playing: boolean }) =>
        useMCKickPlay(gated, playing, setPlaying),
      { initialProps: { gated: true, playing: false } },
    );

    expect(setPlaying).not.toHaveBeenCalled();

    // Drop the gate while paused — must kick play.
    rerender({ gated: false, playing: false });
    expect(setPlaying).toHaveBeenCalledTimes(1);
    expect(setPlaying).toHaveBeenCalledWith(true);
  });

  it('does NOT call setPlaying when ungating but already playing', () => {
    const setPlaying = vi.fn();
    const { rerender } = renderHook(
      ({ gated, playing }: { gated: boolean; playing: boolean }) =>
        useMCKickPlay(gated, playing, setPlaying),
      { initialProps: { gated: true, playing: true } },
    );

    rerender({ gated: false, playing: true });
    expect(setPlaying).not.toHaveBeenCalled();
  });

  it('does NOT fire on the initial render even when starting ungated', () => {
    // First render's effect sees wasMcGatedRef === isMcGated, so the edge
    // does not trigger. Critical: the song was already playing before this
    // hook mounted; we must not re-trigger play on mount.
    const setPlaying = vi.fn();
    renderHook(() => useMCKickPlay(false, false, setPlaying));
    expect(setPlaying).not.toHaveBeenCalled();
  });

  it('does NOT fire when transitioning ungated → gated (start of MC)', () => {
    const setPlaying = vi.fn();
    const { rerender } = renderHook(
      ({ gated }: { gated: boolean }) => useMCKickPlay(gated, true, setPlaying),
      { initialProps: { gated: false } },
    );

    rerender({ gated: true });
    expect(setPlaying).not.toHaveBeenCalled();
  });

  it('fires once per gated→ungated edge across multiple cycles', () => {
    const setPlaying = vi.fn();
    const { rerender } = renderHook(
      ({ gated, playing }: { gated: boolean; playing: boolean }) =>
        useMCKickPlay(gated, playing, setPlaying),
      { initialProps: { gated: true, playing: false } },
    );

    rerender({ gated: false, playing: false }); // edge 1
    expect(setPlaying).toHaveBeenCalledTimes(1);
    rerender({ gated: true, playing: true }); // re-gate
    rerender({ gated: false, playing: false }); // edge 2
    expect(setPlaying).toHaveBeenCalledTimes(2);
  });
});
