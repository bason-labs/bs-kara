import { act, renderHook } from '@testing-library/react-native';
import { detectAdNative, useAdMask, type AdMaskNativeRef } from './useAdMask';

// @bs-kara/shared re-exports firebase which uses ESM syntax not handled by
// jest-expo's transformer. Mock the slice we depend on with a faithful impl.
jest.mock('@bs-kara/shared', () => ({
  parseVideoId: (url: string) => {
    if (!url) return null;
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  },
}));

const SONG = 'songId123';
const AD_URL = 'https://www.youtube.com/watch?v=adXYZ';
const SONG_URL = `https://www.youtube.com/watch?v=${SONG}`;

function refTo(url: string): { current: AdMaskNativeRef } {
  return { current: { getVideoUrl: () => Promise.resolve(url) } };
}

describe('detectAdNative', () => {
  it('reports an ad when playing and the url id differs', async () => {
    await expect(detectAdNative(refTo(AD_URL).current, SONG, true)).resolves.toBe(true);
  });
  it('reports no ad when the url id matches', async () => {
    await expect(detectAdNative(refTo(SONG_URL).current, SONG, true)).resolves.toBe(false);
  });
  it('reports no ad when not playing', async () => {
    await expect(detectAdNative(refTo(AD_URL).current, SONG, false)).resolves.toBe(false);
  });
  it('reports no ad when ref is null', async () => {
    await expect(detectAdNative(null, SONG, true)).resolves.toBe(false);
  });
  it('reports no ad when requestedVideoId is empty', async () => {
    await expect(detectAdNative(refTo(AD_URL).current, '', true)).resolves.toBe(false);
  });
  it('swallows a rejected getVideoUrl and reports no ad', async () => {
    const ref = { getVideoUrl: () => Promise.reject(new Error('teardown')) };
    await expect(detectAdNative(ref, SONG, true)).resolves.toBe(false);
  });
});

describe('useAdMask', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('arms after the ad signal holds across the debounce window', async () => {
    const ref = refTo(AD_URL);
    const { result } = renderHook(() => useAdMask(ref, SONG, true));
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(result.current.isAdGated).toBe(false);
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(result.current.isAdGated).toBe(true);
  });

  it('stays disarmed when not playing', async () => {
    const ref = refTo(AD_URL);
    const { result } = renderHook(() => useAdMask(ref, SONG, false));
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(result.current.isAdGated).toBe(false);
  });

  it('stays disarmed when requestedVideoId is empty', async () => {
    const ref = refTo(AD_URL);
    const { result } = renderHook(() => useAdMask(ref, '', true));
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(result.current.isAdGated).toBe(false);
  });

  it('force-clears a stuck gate after the safety cap', async () => {
    const ref = refTo(AD_URL);
    const { result } = renderHook(() => useAdMask(ref, SONG, true));
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(result.current.isAdGated).toBe(true);
    await act(async () => { jest.advanceTimersByTime(45_000); });
    expect(result.current.isAdGated).toBe(false);
  });
});
