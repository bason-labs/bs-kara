import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { YouTubeVideo } from '@/lib/youtube/types';
import { useMCPlayer } from './useMCPlayer';

const speakMock = vi.fn().mockResolvedValue(undefined);
const cancelMock = vi.fn();

vi.mock('./useAIVoice', () => ({
  useAIVoice: () => ({
    speak: speakMock,
    cancel: cancelMock,
    previewVoice: vi.fn(),
    voicesReady: true,
  }),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  speakMock.mockClear();
  cancelMock.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function song(over: Partial<YouTubeVideo> = {}): YouTubeVideo {
  return {
    id: 's1',
    title: 'Song',
    channel: 'C',
    thumbnail: '',
    duration: '',
    ...over,
  };
}

describe('useMCPlayer', () => {
  it('does not gate when ready=false', () => {
    const { result } = renderHook(() =>
      useMCPlayer({
        isMCEnabled: true,
        currentPlaying: song(),
        ready: false,
      }),
    );
    expect(result.current.isMcGated).toBe(false);
  });

  it('does not gate when MC is disabled even if ready', async () => {
    const { result } = renderHook(() =>
      useMCPlayer({
        isMCEnabled: false,
        currentPlaying: song(),
        ready: true,
      }),
    );
    await waitFor(() => expect(result.current.isMcGated).toBe(false));
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('starts gated immediately when ready+enabled+song are present at mount', () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'hi' }),
    });
    const { result } = renderHook(() =>
      useMCPlayer({
        isMCEnabled: true,
        currentPlaying: song({ mcText: 'pre' }),
        ready: true,
      }),
    );
    expect(result.current.isMcGated).toBe(true);
  });

  it('uses the pre-generated mcText without hitting /api/generate-mc', async () => {
    const { result } = renderHook(() =>
      useMCPlayer({
        isMCEnabled: true,
        currentPlaying: song({ mcText: 'pre-cached line' }),
        ready: true,
      }),
    );
    await waitFor(() => expect(speakMock).toHaveBeenCalledWith('pre-cached line', undefined));
    expect(fetchMock).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.isMcGated).toBe(false));
  });

  it('falls back to /api/generate-mc when the song carries no mcText', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'live line' }),
    });
    const { result } = renderHook(() =>
      useMCPlayer({
        isMCEnabled: true,
        currentPlaying: song(),
        ready: true,
      }),
    );
    // useMCPlayer polls for up to 4s waiting for a pre-generated mcText
    // before falling back to the live API call.
    await waitFor(
      () => expect(speakMock).toHaveBeenCalledWith('live line', undefined),
      { timeout: 6000 },
    );
    expect(fetchMock).toHaveBeenCalled();
    await waitFor(() => expect(result.current.isMcGated).toBe(false));
  }, 10000);

  it('skips speech when the lock claim returns false', async () => {
    const claim = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() =>
      useMCPlayer({
        isMCEnabled: true,
        currentPlaying: song({ mcText: 'pre' }),
        ready: true,
        tryClaimAnnouncementLock: claim,
      }),
    );
    await waitFor(() => expect(claim).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(result.current.isMcGated).toBe(false));
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('releases the gate without speaking when both pre and live text are missing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
    const { result } = renderHook(() =>
      useMCPlayer({
        isMCEnabled: true,
        currentPlaying: song(),
        ready: true,
      }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 6000 });
    await waitFor(() => expect(result.current.isMcGated).toBe(false));
    expect(speakMock).not.toHaveBeenCalled();
  }, 10000);

  it('calls speak with the mcVoice prop', async () => {
    const { result } = renderHook(() =>
      useMCPlayer({
        isMCEnabled: true,
        currentPlaying: song({ mcText: 'a' }),
        ready: true,
        mcVoice: 'vi-VN-Wavenet-B',
      }),
    );
    await waitFor(() => expect(speakMock).toHaveBeenCalledWith('a', 'vi-VN-Wavenet-B'));
    await waitFor(() => expect(result.current.isMcGated).toBe(false));
  });

  // Regression: a fast skip-skip-skip used to leave the prior song's
  // /api/generate-mc fetch in flight (the existing cancelled-flag prevented
  // setState clobbering, but the network call still ran to completion).
  // After the fix, the effect cleanup aborts the in-flight fetch's signal so
  // the upstream call is actually cancelled.
  it('aborts the in-flight live MC fetch when the song changes', async () => {
    let capturedSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url, init) => {
      capturedSignal = (init as { signal?: AbortSignal } | undefined)?.signal;
      // Never-resolving promise so the fetch stays in flight until aborted.
      return new Promise(() => {});
    });

    const { rerender } = renderHook(
      (props: Parameters<typeof useMCPlayer>[0]) => useMCPlayer(props),
      {
        initialProps: {
          isMCEnabled: true,
          // No mcText → the hook falls through to /api/generate-mc after the
          // 4s poll budget expires.
          currentPlaying: song({ id: 'first' }),
          ready: true,
        } as Parameters<typeof useMCPlayer>[0],
      },
    );

    // Wait for the live fetch to be issued (after the 4s poll budget).
    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 6000 });
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);

    // Song change → effect cleanup must abort the in-flight fetch's signal.
    rerender({
      isMCEnabled: true,
      currentPlaying: song({ id: 'second', mcText: 'next' }),
      ready: true,
    });

    await waitFor(() => expect(capturedSignal!.aborted).toBe(true));
  }, 10000);

  it('clears state when currentPlaying becomes null', async () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useMCPlayer>[0]) => useMCPlayer(props),
      {
        initialProps: {
          isMCEnabled: true,
          currentPlaying: song({ mcText: 'a' }),
          ready: true,
        } as Parameters<typeof useMCPlayer>[0],
      },
    );
    await waitFor(() => expect(speakMock).toHaveBeenCalled());
    rerender({ isMCEnabled: true, currentPlaying: null, ready: true });
    await waitFor(() => expect(result.current.isMcGated).toBe(false));
    expect(cancelMock).toHaveBeenCalled();
  });
});
