import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureVoice, primeVoiceAudio, speakVoice, VoiceAudioError } from './audio';

let level = 128;
let recorder: Recorder;
let audio: Playback;
let utterance: SpeechSynthesisUtterance;
const trackStop = vi.fn();
const disconnect = vi.fn();
const close = vi.fn(async () => {});
const stream = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
const getUserMedia = vi.fn();
const fetchMock = vi.fn();
const cancel = vi.fn();

class Recorder {
  static isTypeSupported = vi.fn((type: string) => type === 'audio/webm;codecs=opus');
  state = 'inactive';
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    // Expose the browser-created instance so tests can deliver native events.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    recorder = this;
    this.mimeType = options?.mimeType ?? 'audio/webm';
  }
  start() { this.state = 'recording'; }
  stop = vi.fn(() => {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['recording'], { type: this.mimeType }) });
      this.onstop?.();
    });
  });
}

class Context {
  state = 'running';
  resume = vi.fn(async () => {});
  close = close;
  createMediaStreamSource() { return { connect: vi.fn(), disconnect }; }
  createAnalyser() {
    return { fftSize: 2048, disconnect, getByteTimeDomainData: (data: Uint8Array) => data.fill(level) };
  }
}

class Playback {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(async () => {});
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();
  constructor(public src: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    audio = this;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  level = 128;
  getUserMedia.mockReset().mockResolvedValue(stream);
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ audioContent: 'BASE64' }) });
  Recorder.isTypeSupported.mockImplementation(type => type === 'audio/webm;codecs=opus');
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('MediaRecorder', Recorder);
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal('Audio', Playback);
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  vi.stubGlobal('speechSynthesis', {
    cancel, getVoices: () => [], paused: false,
    speak: vi.fn((value: SpeechSynthesisUtterance) => { utterance = value; }),
  });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const flush = () => vi.advanceTimersByTimeAsync(0);
const start = (controller = new AbortController()) => captureVoice({ signal: controller.signal, onListening: vi.fn() });

describe('captureVoice', () => {
  it('records speech through 1.2 seconds of silence, with proper MIME and cleanup', async () => {
    const onListening = vi.fn();
    const result = captureVoice({ signal: new AbortController().signal, onListening });
    await flush();
    expect(onListening).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: true, noiseSuppression: true } });
    level = 145;
    await vi.advanceTimersByTimeAsync(300);
    level = 128;
    await vi.advanceTimersByTimeAsync(1100);
    expect(trackStop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    const blob = await result;
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('audio/webm;codecs=opus');
    expect(trackStop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects no speech at seven seconds and releases the microphone', async () => {
    const result = expect(start()).rejects.toMatchObject({ code: 'noSpeech' });
    await vi.advanceTimersByTimeAsync(7100);
    await result;
    expect(trackStop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('caps continuous speech at fifteen seconds and supports mp4', async () => {
    Recorder.isTypeSupported.mockImplementation(type => type === 'audio/mp4');
    level = 145;
    const result = start();
    await vi.advanceTimersByTimeAsync(15100);
    expect((await result).type).toBe('audio/mp4');
    expect(trackStop).toHaveBeenCalledOnce();
  });

  it('aborts immediately while permission is pending and stops a late stream', async () => {
    let deliver!: (stream: MediaStream) => void;
    getUserMedia.mockReturnValue(new Promise(resolve => { deliver = resolve; }));
    const controller = new AbortController();
    const result = expect(start(controller)).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await result;
    deliver(stream);
    await flush();
    expect(trackStop).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });

  it('stops recording and every resource on abort', async () => {
    const controller = new AbortController();
    const result = expect(start(controller)).rejects.toMatchObject({ name: 'AbortError' });
    await flush();
    controller.abort();
    await result;
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(trackStop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not request the microphone with an already aborted signal', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(start(controller)).rejects.toMatchObject({ name: 'AbortError' });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('provides actionable permission and unsupported errors', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    await expect(start()).rejects.toMatchObject({ code: 'permission', name: 'VoiceAudioError' });
    vi.stubGlobal('MediaRecorder', undefined);
    await expect(start()).rejects.toBeInstanceOf(VoiceAudioError);
    await expect(start()).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('cleans up a recorder failure', async () => {
    const result = expect(start()).rejects.toMatchObject({ code: 'recording' });
    await flush();
    recorder.onerror?.();
    await result;
    expect(trackStop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('waits for final recorder data and rejects if the stop event never arrives', async () => {
    level = 145;
    const result = expect(start()).rejects.toMatchObject({ code: 'recording' });
    await flush();
    recorder.stop.mockImplementation(() => { recorder.state = 'inactive'; });
    await vi.advanceTimersByTimeAsync(15000);
    expect(trackStop).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(2000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not return a blob before the recorder delivers its final chunk', async () => {
    level = 145;
    const done = vi.fn();
    const result = start().then(done);
    await flush();
    recorder.stop.mockImplementation(() => { recorder.state = 'inactive'; });
    await vi.advanceTimersByTimeAsync(15000);
    expect(done).not.toHaveBeenCalled();
    recorder.ondataavailable?.({ data: new Blob(['last chunk'], { type: recorder.mimeType }) });
    recorder.onstop?.();
    await result;
    expect(done.mock.calls[0][0].size).toBe(10);
  });
});

describe('speakVoice', () => {
  it('reuses gesture-primed audio without opening the microphone or cancelling other speech', async () => {
    primeVoiceAudio();
    const primed = audio;
    expect(primed.play).toHaveBeenCalledOnce();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    const result = speakVoice('xin chao', 'vi', new AbortController().signal);
    await flush();
    expect(audio).toBe(primed);
    expect(audio.src).toContain('data:audio/mpeg;base64,BASE64');
    audio.onended?.();
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('posts Vietnamese text and waits for playback end, not play() resolution', async () => {
    const done = vi.fn();
    const result = speakVoice('xin chao', 'vi', new AbortController().signal).then(done);
    await flush();
    expect(fetchMock).toHaveBeenCalledWith('/api/tts', expect.objectContaining({ method: 'POST', body: JSON.stringify({ text: 'xin chao' }) }));
    expect(audio.src).toBe('data:audio/mpeg;base64,BASE64');
    expect(done).not.toHaveBeenCalled();
    audio.onended?.();
    await result;
    expect(done).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts its audio without cancelling unrelated browser speech', async () => {
    const controller = new AbortController();
    const result = expect(speakVoice('xin chao', 'vi', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await flush();
    controller.abort();
    await result;
    expect(audio.pause).toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts even a pending fetch and ignores its late response', async () => {
    let deliver!: (response: unknown) => void;
    fetchMock.mockReturnValue(new Promise(resolve => { deliver = resolve; }));
    const controller = new AbortController();
    const result = expect(speakVoice('xin chao', 'vi', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await result;
    deliver({ ok: true, json: async () => ({ audioContent: 'LATE' }) });
    await flush();
    expect(cancel).not.toHaveBeenCalled();
    expect(speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it.each(['en', 'vi'] as const)('waits for browser speech end with %s locale', async language => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const done = vi.fn();
    const result = speakVoice('hello', language, new AbortController().signal).then(done);
    await flush();
    expect(utterance.lang).toBe(language === 'vi' ? 'vi-VN' : 'en-US');
    utterance.onstart?.({} as SpeechSynthesisEvent);
    expect(done).not.toHaveBeenCalled();
    utterance.onend?.({} as SpeechSynthesisEvent);
    await result;
  });

  it('only cancels browser speech after its own utterance starts', async () => {
    const controller = new AbortController();
    const result = expect(speakVoice('hello', 'en', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await flush();
    controller.abort();
    await result;
    expect(cancel).not.toHaveBeenCalled();
    utterance.onstart?.({} as SpeechSynthesisEvent);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('cancels active owned browser speech on abort', async () => {
    const controller = new AbortController();
    const result = expect(speakVoice('hello', 'en', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await flush();
    utterance.onstart?.({} as SpeechSynthesisEvent);
    controller.abort();
    await result;
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('rejects failed browser output instead of reporting success', async () => {
    const result = expect(speakVoice('hello', 'en', new AbortController().signal)).rejects.toThrow(/speech|voice|audio/i);
    await flush();
    utterance.onerror?.({ error: 'not-allowed' } as SpeechSynthesisErrorEvent);
    await result;
  });

  it('bounds output when the browser never sends completion', async () => {
    const result = expect(speakVoice('hello', 'en', new AbortController().signal)).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(120000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('falls back after failed Vietnamese playback and awaits fallback completion', async () => {
    const done = vi.fn();
    const result = speakVoice('xin chao', 'vi', new AbortController().signal).then(done);
    await flush();
    audio.onerror?.();
    await flush();
    expect(audio.pause).toHaveBeenCalled();
    expect(utterance.lang).toBe('vi-VN');
    expect(done).not.toHaveBeenCalled();
    utterance.onstart?.({} as SpeechSynthesisEvent);
    utterance.onend?.({} as SpeechSynthesisEvent);
    await result;
  });

  it('rejects when Vietnamese and browser output are both unavailable', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    vi.stubGlobal('speechSynthesis', undefined);
    await expect(speakVoice('xin chao', 'vi', new AbortController().signal)).rejects.toThrow(/unavailable/);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds a stalled TTS body and then reports failed fallback', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => new Promise(() => {}) });
    vi.stubGlobal('speechSynthesis', undefined);
    const result = expect(speakVoice('xin chao', 'vi', new AbortController().signal)).rejects.toThrow(/unavailable/);
    await vi.advanceTimersByTimeAsync(10000);
    await result;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
