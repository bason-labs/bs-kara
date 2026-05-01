import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { primeAudio, useAIVoice } from './useAIVoice';

// Track every Audio instance so tests can fire `onended` / `onerror`.
const audioInstances: MockAudio[] = [];

class MockAudio {
  src = '';
  volume = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  paused = false;
  private playResolver: ((v: void) => void) | null = null;
  playPromise: Promise<void>;
  played = false;

  constructor(src?: string) {
    if (src) this.src = src;
    this.playPromise = new Promise((r) => (this.playResolver = r));
    audioInstances.push(this);
  }

  play() {
    this.played = true;
    this.playResolver?.();
    return this.playPromise;
  }
  pause() {
    this.paused = true;
  }
  removeAttribute() {
    this.src = '';
  }
  load() {}
  setAttribute() {}
}

const fetchMock = vi.fn();

beforeEach(() => {
  audioInstances.length = 0;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useAIVoice.speak', () => {
  it('plays Google TTS audio when /api/tts succeeds', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ audioContent: 'BASE64' }),
    });
    const { result } = renderHook(() => useAIVoice());

    let speakPromise!: Promise<void>;
    act(() => {
      speakPromise = result.current.speak('hello');
    });

    await waitFor(() => expect(audioInstances.length).toBe(1));
    const audio = audioInstances[0];
    expect(audio.src).toContain('data:audio/mpeg;base64,BASE64');
    expect(audio.played).toBe(true);
    audio.onended?.();
    await speakPromise;
  });

  it('falls back to browser TTS on a non-2xx /api/tts response', async () => {
    const synthSpeak = vi.spyOn(window.speechSynthesis, 'speak');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useAIVoice());
    let p!: Promise<void>;
    act(() => {
      p = result.current.speak('hi');
    });
    await waitFor(() => expect(synthSpeak).toHaveBeenCalled());
    // The browser-TTS path resolves via onend; trigger it to release the promise.
    const utter = synthSpeak.mock.calls[0][0];
    utter.onend?.(new Event('end') as SpeechSynthesisEvent);
    await p;
  });

  it('falls back to browser TTS when fetch throws', async () => {
    const synthSpeak = vi.spyOn(window.speechSynthesis, 'speak');
    fetchMock.mockRejectedValue(new Error('net'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useAIVoice());
    act(() => {
      void result.current.speak('hi');
    });
    await waitFor(() => expect(synthSpeak).toHaveBeenCalled());
  });

  it('returns immediately for whitespace-only text without calling fetch', async () => {
    const { result } = renderHook(() => useAIVoice());
    await act(() => result.current.speak('   '));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('useAIVoice.cancel', () => {
  it('cancels speechSynthesis and pauses any in-flight audio', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ audioContent: 'X' }),
    });
    const synthCancel = vi.spyOn(window.speechSynthesis, 'cancel');

    const { result } = renderHook(() => useAIVoice());
    act(() => {
      void result.current.speak('hi');
    });
    await waitFor(() => expect(audioInstances.length).toBe(1));

    act(() => result.current.cancel());
    expect(synthCancel).toHaveBeenCalled();
    expect(audioInstances[0].paused).toBe(true);
  });
});

describe('useAIVoice.previewVoice', () => {
  it('aborts a previous in-flight preview when called again', async () => {
    let abortedFirst = false;
    let firstResolve: (v: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
    const firstResponse = new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>(
      (r) => {
        firstResolve = r;
      },
    );
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      init.signal?.addEventListener('abort', () => {
        abortedFirst = true;
      });
      return firstResponse;
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ audioContent: 'OK' }),
    });

    const { result } = renderHook(() => useAIVoice());

    act(() => {
      void result.current.previewVoice('vi-VN-Wavenet-B', 'hi');
    });
    await act(async () => {
      void result.current.previewVoice('vi-VN-Neural2-A', 'hi');
    });

    expect(abortedFirst).toBe(true);
    // Resolve the first request late — the abort already short-circuited the path.
    firstResolve!({
      ok: true,
      status: 200,
      json: async () => ({ audioContent: 'STALE' }),
    });
  });

  it('skips work when text is whitespace', async () => {
    const { result } = renderHook(() => useAIVoice());
    await act(() => result.current.previewVoice('vi-VN-Neural2-A', '   '));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('primeAudio', () => {
  it('queues a silent utterance and plays a silent Audio element', () => {
    const synthSpeak = vi.spyOn(window.speechSynthesis, 'speak');
    primeAudio();
    expect(synthSpeak).toHaveBeenCalled();
    expect(audioInstances.length).toBe(1);
    expect(audioInstances[0].volume).toBe(0);
  });

  it('swallows synth errors silently', () => {
    vi.spyOn(window.speechSynthesis, 'speak').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => primeAudio()).not.toThrow();
  });
});
