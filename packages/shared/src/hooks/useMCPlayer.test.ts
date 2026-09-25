import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { YouTubeVideo } from '../lib/youtube/types';
import { useMCPlayer, type MCVoice } from './useMCPlayer';

// App-specific behaviour (gating, lock, pre-generated text, abort on song change) is
// covered through the web wrapper in apps/web/hooks/useMCPlayer.test.ts. These tests
// cover what the shared hook adds for React Native: the API origin and a timeout that
// doesn't depend on AbortSignal.timeout / AbortSignal.any (missing in Hermes).

const fetchMock = vi.fn();
const voice: MCVoice = { speak: vi.fn().mockResolvedValue(undefined), cancel: vi.fn() };

// No mcText, so the hook polls for a pre-generated line (4 s budget) and then
// asks /api/generate-mc live.
const song: YouTubeVideo = { id: 's1', title: 'Song', channel: 'C', thumbnail: '', duration: '' };

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.mocked(voice.speak).mockClear();
  vi.mocked(voice.cancel).mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useMCPlayer (shared)', () => {
  it('sends the live MC request to apiBase when one is given', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ text: 'Xin mời!' }) });

    renderHook(() =>
      useMCPlayer({ isMCEnabled: true, currentPlaying: song, ready: true, voice, apiBase: 'https://kara.example.com' }),
    );
    await act(() => vi.advanceTimersByTimeAsync(4_200));

    expect(fetchMock).toHaveBeenCalledWith('https://kara.example.com/api/generate-mc', expect.anything());
  });

  it('aborts a hanging live MC request after 6 seconds and releases the gate', async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });

    const { result } = renderHook(() =>
      useMCPlayer({ isMCEnabled: true, currentPlaying: song, ready: true, voice }),
    );
    await act(() => vi.advanceTimersByTimeAsync(4_200));
    expect(signal?.aborted).toBe(false);
    expect(result.current.isMcGated).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(6_000));

    expect(signal?.aborted).toBe(true);
    expect(result.current.isMcGated).toBe(false);
    expect(voice.speak).not.toHaveBeenCalled();
  });
});
