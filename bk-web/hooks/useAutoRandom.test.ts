import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RandomFilters, YouTubeVideo } from '@/lib/youtube/types';
import { useAutoRandom } from './useAutoRandom';

vi.mock('@/lib/youtube/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/youtube/client')>('@/lib/youtube/client');
  return { ...actual, searchYouTube: vi.fn() };
});

import { searchYouTube } from '@/lib/youtube/client';
const search = searchYouTube as unknown as ReturnType<typeof vi.fn>;

const baseFilters: RandomFilters = { type: 'all', tone: 'all', genre: 'all' };

beforeEach(() => search.mockReset());
afterEach(() => vi.restoreAllMocks());

function makeProps(over: Partial<Parameters<typeof useAutoRandom>[0]> = {}) {
  return {
    enabled: true,
    ready: true,
    hasCurrentPlaying: false,
    queueLength: 0,
    randomFilters: baseFilters,
    playedHistory: [],
    setCurrentPlayingDirectly: vi.fn().mockResolvedValue(undefined),
    addToPlayedHistory: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

const fakeVideo: YouTubeVideo = {
  id: 'fresh',
  title: 'Fresh',
  channel: 'c',
  thumbnail: '',
  duration: '',
};

describe('useAutoRandom', () => {
  it('does not fire when ready=false', async () => {
    const props = makeProps({ ready: false });
    renderHook(() => useAutoRandom(props));
    await new Promise((r) => setTimeout(r, 0));
    expect(search).not.toHaveBeenCalled();
    expect(props.setCurrentPlayingDirectly).not.toHaveBeenCalled();
  });

  it('does not fire when enabled=false', async () => {
    const props = makeProps({ enabled: false });
    renderHook(() => useAutoRandom(props));
    await new Promise((r) => setTimeout(r, 0));
    expect(search).not.toHaveBeenCalled();
  });

  it('does not fire when something is currently playing', async () => {
    const props = makeProps({ hasCurrentPlaying: true });
    renderHook(() => useAutoRandom(props));
    await new Promise((r) => setTimeout(r, 0));
    expect(search).not.toHaveBeenCalled();
  });

  it('does not fire when the queue has user picks', async () => {
    const props = makeProps({ queueLength: 3 });
    renderHook(() => useAutoRandom(props));
    await new Promise((r) => setTimeout(r, 0));
    expect(search).not.toHaveBeenCalled();
  });

  it('fetches a song and writes it to currentPlaying when conditions are met', async () => {
    search.mockResolvedValue({ videos: [fakeVideo] });
    const props = makeProps();
    renderHook(() => useAutoRandom(props));

    await waitFor(() => expect(props.setCurrentPlayingDirectly).toHaveBeenCalledWith(fakeVideo));
    expect(props.addToPlayedHistory).toHaveBeenCalledWith('fresh');
  });

  it('retries a different title when the first batch returns no usable video', async () => {
    search
      .mockResolvedValueOnce({ videos: [] })
      .mockResolvedValueOnce({ videos: [fakeVideo] });
    const props = makeProps();
    renderHook(() => useAutoRandom(props));

    await waitFor(() => expect(props.setCurrentPlayingDirectly).toHaveBeenCalledTimes(1));
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('gives up after 5 attempts when no candidate ever appears', async () => {
    search.mockResolvedValue({ videos: [] });
    const props = makeProps();
    renderHook(() => useAutoRandom(props));

    await waitFor(() => expect(search).toHaveBeenCalledTimes(5));
    expect(props.setCurrentPlayingDirectly).not.toHaveBeenCalled();
  });
});
