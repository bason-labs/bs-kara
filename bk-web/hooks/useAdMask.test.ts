import { describe, expect, it } from 'vitest';
import { detectAd, parseVideoId } from './useAdMask';

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
