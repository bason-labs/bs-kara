import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectAd, parseVideoId, useAdMask, type AdMaskPlayer } from './useAdMask';

const SONG = 'songId123';
const playing = (url: string) => ({
  getPlayerState: () => 1, // YT PLAYING
  getVideoUrl: () => url,
});

describe('parseVideoId', () => {
  it('extracts the v= id from a watch URL', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=abc123&t=4')).toBe('abc123');
  });
  it('returns null for an empty or non-watch URL', () => {
    expect(parseVideoId('')).toBeNull();
    expect(parseVideoId('https://www.youtube.com/')).toBeNull();
  });
});

describe('detectAd', () => {
  it('reports an ad when PLAYING and the url id differs from the requested id', () => {
    expect(detectAd(playing('https://www.youtube.com/watch?v=adXYZ'), SONG)).toBe(true);
  });
  it('reports no ad when the url id matches the requested id', () => {
    expect(detectAd(playing(`https://www.youtube.com/watch?v=${SONG}`), SONG)).toBe(false);
  });
  it('reports no ad when the player is not PLAYING', () => {
    const paused = { getPlayerState: () => 2, getVideoUrl: () => 'https://www.youtube.com/watch?v=adXYZ' };
    expect(detectAd(paused, SONG)).toBe(false);
  });
  it('reports no ad on an empty / unparseable url', () => {
    expect(detectAd(playing(''), SONG)).toBe(false);
  });
  it('reports no ad when requestedVideoId is empty', () => {
    expect(detectAd(playing('https://www.youtube.com/watch?v=adXYZ'), '')).toBe(false);
  });
  it('swallows getter errors and reports no ad', () => {
    const thrower = {
      getPlayerState: () => { throw new Error('teardown'); },
      getVideoUrl: () => '',
    };
    expect(detectAd(thrower, SONG)).toBe(false);
  });
});

describe('useAdMask', () => {
  const SONG = 'songId123';
  const AD_URL = 'https://www.youtube.com/watch?v=adXYZ';
  const SONG_URL = `https://www.youtube.com/watch?v=${SONG}`;

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function makePlayer(initialUrl: string) {
    const ref = { url: initialUrl };
    return {
      player: { getPlayerState: () => 1, getVideoUrl: () => ref.url } as AdMaskPlayer,
      setUrl: (u: string) => { ref.url = u; },
    };
  }

  it('arms only after the ad signal holds across the debounce window', () => {
    const { player } = makePlayer(AD_URL);
    const { result } = renderHook(() => useAdMask(player, SONG, true));
    expect(result.current.isAdGated).toBe(false);
    act(() => vi.advanceTimersByTime(250)); // 1st ad poll
    expect(result.current.isAdGated).toBe(false);
    act(() => vi.advanceTimersByTime(250)); // 2nd ad poll → arm
    expect(result.current.isAdGated).toBe(true);
  });

  it('disarms after the song signal holds across the debounce window', () => {
    const { player, setUrl } = makePlayer(AD_URL);
    const { result } = renderHook(() => useAdMask(player, SONG, true));
    act(() => vi.advanceTimersByTime(500)); // arm
    expect(result.current.isAdGated).toBe(true);
    act(() => setUrl(SONG_URL));
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.isAdGated).toBe(true);
    act(() => vi.advanceTimersByTime(250)); // 2nd song poll → disarm
    expect(result.current.isAdGated).toBe(false);
  });

  it('stays disarmed when player is null', () => {
    const { result } = renderHook(() => useAdMask(null, SONG, true));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.isAdGated).toBe(false);
  });

  it('stays disarmed when requestedVideoId is empty', () => {
    const { player } = makePlayer(AD_URL);
    const { result } = renderHook(() => useAdMask(player, '', true));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.isAdGated).toBe(false);
  });

  it('stays disarmed when isPlaying is false', () => {
    const { player } = makePlayer(AD_URL);
    const { result } = renderHook(() => useAdMask(player, SONG, false));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.isAdGated).toBe(false);
  });

  it('force-clears a stuck gate after the safety cap', () => {
    const { player } = makePlayer(AD_URL); // stays on the ad url forever
    const { result } = renderHook(() => useAdMask(player, SONG, true));
    act(() => vi.advanceTimersByTime(500)); // arm
    expect(result.current.isAdGated).toBe(true);
    act(() => vi.advanceTimersByTime(45_000)); // safety cap fires
    expect(result.current.isAdGated).toBe(false);
  });

  it('clears its interval on unmount', () => {
    const clear = vi.spyOn(window, 'clearInterval');
    const { player } = makePlayer(AD_URL);
    const { unmount } = renderHook(() => useAdMask(player, SONG, true));
    unmount();
    expect(clear).toHaveBeenCalled();
  });

  it('does not disarm an active gate when re-armed after guard was active', () => {
    const { player } = makePlayer(AD_URL);
    const { result, rerender } = renderHook(
      ({ isPlaying }) => useAdMask(player, SONG, isPlaying),
      { initialProps: { isPlaying: false } },
    );
    // Guard is active, deferred reset scheduled
    expect(result.current.isAdGated).toBe(false);

    // Re-render to activate polling; cleanup cancels the deferred reset
    rerender({ isPlaying: true });

    // Let polling arm the gate
    act(() => vi.advanceTimersByTime(500));

    // Gate should be armed; the stale deferred reset did not fire
    expect(result.current.isAdGated).toBe(true);
  });
});
