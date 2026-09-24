'use client';

export class VoiceAudioError extends Error {
  constructor(
    public readonly code: 'unsupported' | 'permission' | 'noSpeech' | 'recording',
    message: string,
  ) {
    super(message);
    this.name = 'VoiceAudioError';
  }
}

const abortError = () => new DOMException('Voice operation cancelled.', 'AbortError');
const recordingError = () => new VoiceAudioError('recording', 'Could not record audio. Check your microphone and try again.');

let primedAudio: HTMLAudioElement | undefined;
let primeTimer: ReturnType<typeof setTimeout> | undefined;

// Call synchronously from a user gesture. Reusing this element matters on iOS.
export function primeVoiceAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    if (!primedAudio) primedAudio = new Audio();
    const audio = primedAudio;
    clearTimeout(primeTimer);
    audio.src = 'data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YQEAAACA';
    audio.volume = 0;
    const release = () => {
      if (primedAudio !== audio) return;
      clearTimeout(primeTimer);
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
    audio.onended = release;
    audio.onerror = release;
    primeTimer = setTimeout(release, 1000);
    void audio.play().catch(release);
    window.speechSynthesis?.getVoices();
  } catch { /* Priming is a hint; actual output reports playback failures. */ }
}

export async function captureVoice({ signal, onListening }: {
  signal: AbortSignal;
  onListening: () => void;
}): Promise<Blob> {
  if (signal.aborted) throw abortError();
  const Context = typeof window !== 'undefined'
    ? window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;
  if (!globalThis.navigator?.mediaDevices?.getUserMedia || !globalThis.MediaRecorder || !Context) {
    throw new VoiceAudioError('unsupported', 'Voice recording is unavailable. Use a supported browser over HTTPS.');
  }

  return new Promise<Blob>((resolve, reject) => {
    let settled = false;
    let stopping = false;
    let stream: MediaStream | undefined;
    let recorder: MediaRecorder | undefined;
    let context: AudioContext | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let analyser: AnalyserNode | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let limit: ReturnType<typeof setTimeout> | undefined;
    let stopLimit: ReturnType<typeof setTimeout> | undefined;
    const chunks: Blob[] = [];

    const releaseInput = () => {
      clearInterval(poll);
      clearTimeout(limit);
      source?.disconnect();
      analyser?.disconnect();
      source = undefined;
      analyser = undefined;
      stream?.getTracks().forEach(track => track.stop());
      stream = undefined;
      if (context) {
        void context.close().catch(() => {});
        context = undefined;
      }
    };
    const finish = (error?: Error, blob?: Blob) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      clearTimeout(stopLimit);
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state !== 'inactive') {
          try { recorder.stop(); } catch { /* The device may already have disconnected. */ }
        }
      }
      releaseInput();
      if (error) reject(error);
      else resolve(blob!);
    };
    const abort = () => finish(abortError());
    const stop = () => {
      if (settled || stopping) return;
      stopping = true;
      // Keep recorder handlers until the final dataavailable/stop pair arrives.
      stopLimit = setTimeout(() => finish(recordingError()), 2000);
      try { recorder!.stop(); } catch { finish(recordingError()); }
      releaseInput();
    };
    signal.addEventListener('abort', abort, { once: true });

    void navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then(async acquired => {
        if (settled || signal.aborted) {
          acquired.getTracks().forEach(track => track.stop());
          return;
        }
        stream = acquired;
        try {
          context = new Context();
          source = context.createMediaStreamSource(acquired);
          analyser = context.createAnalyser();
          analyser.fftSize = 2048;
          source.connect(analyser);
          if (context.state === 'suspended') await context.resume();
          if (settled) return;
          const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
            .find(type => MediaRecorder.isTypeSupported(type));
          recorder = new MediaRecorder(acquired, mimeType ? { mimeType } : undefined);
          recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
          recorder.onerror = () => finish(recordingError());
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: recorder!.mimeType || chunks[0]?.type || mimeType });
            if (!stopping || !blob.size) finish(recordingError());
            else finish(undefined, blob);
          };
          recorder.start();
          const samples = new Uint8Array(analyser!.fftSize);
          const started = Date.now();
          let speechDetected = false;
          let lastSpeech = started;
          poll = setInterval(() => {
            try {
              analyser!.getByteTimeDomainData(samples);
              let energy = 0;
              for (const sample of samples) energy += ((sample - 128) / 128) ** 2;
              const now = Date.now();
              if (Math.sqrt(energy / samples.length) > 0.02) {
                speechDetected = true;
                lastSpeech = now;
              }
              if (speechDetected && now - lastSpeech >= 1200) stop();
              else if (!speechDetected && now - started >= 7000) {
                finish(new VoiceAudioError('noSpeech', 'No speech detected. Move closer to the microphone and try again.'));
              }
            } catch { finish(recordingError()); }
          }, 100);
          limit = setTimeout(() => speechDetected ? stop() : finish(
            new VoiceAudioError('noSpeech', 'No speech detected. Check your microphone and try again.'),
          ), 15000);
          onListening();
        } catch { finish(recordingError()); }
      }, error => {
        const permission = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
        finish(permission
          ? new VoiceAudioError('permission', 'Microphone access was denied. Allow microphone access in your browser settings and try again.')
          : recordingError());
      });
  });
}

function outputError(message: string): Error {
  return new Error(`${message} Read the response or try voice playback again.`);
}

function outputTimeout(text: string): number {
  return Math.min(90000, Math.max(10000, text.split(/\s+/).length * 700 + 5000));
}

function playAudio(content: string, text: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const audio = primedAudio ?? new Audio();
    primedAudio = undefined;
    clearTimeout(primeTimer);
    audio.onended = null;
    audio.onerror = null;
    audio.src = `data:audio/mpeg;base64,${content}`;
    audio.volume = 1;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(abortError());
    const timer = setTimeout(() => finish(outputError('Audio playback timed out.')), outputTimeout(text));
    signal.addEventListener('abort', abort, { once: true });
    audio.onended = () => finish();
    audio.onerror = () => finish(outputError('Audio playback failed.'));
    try {
      void audio.play().catch(() => finish(outputError('Audio playback was blocked or failed.')));
    } catch { finish(outputError('Audio playback could not start.')); }
  });
}

function browserSpeech(text: string, language: 'vi' | 'en', signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const synth = globalThis.speechSynthesis;
    if (!synth || !globalThis.SpeechSynthesisUtterance) {
      reject(outputError('Browser voice output is unavailable.'));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'vi' ? 'vi-VN' : 'en-US';
    const voice = synth.getVoices().find(candidate => candidate.lang.toLowerCase().startsWith(`${language}-`));
    if (voice) utterance.voice = voice;
    let active = false;
    let started = false;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      utterance.onend = null;
      utterance.onerror = null;
      if (error && active) {
        active = false;
        synth.cancel();
      }
      // A queued utterance cannot be removed individually. Silence it now and
      // cancel only when its own start event proves that it owns the engine.
      if (error && !started) { utterance.text = ''; utterance.volume = 0; }
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(abortError());
    const timer = setTimeout(() => finish(outputError('Browser speech timed out.')), outputTimeout(text));
    signal.addEventListener('abort', abort, { once: true });
    utterance.onstart = () => {
      started = true;
      if (settled) { synth.cancel(); return; }
      active = true;
    };
    utterance.onend = () => {
      active = false;
      finish(started ? undefined : outputError('Browser speech ended without starting.'));
    };
    utterance.onerror = event => {
      active = false;
      finish(outputError(`Browser speech failed (${event.error}).`));
    };
    try {
      if (synth.paused) synth.resume();
      synth.speak(utterance);
    } catch { finish(outputError('Browser speech could not start.')); }
  });
}

async function requestAudio(text: string, signal: AbortSignal): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: () => void = () => {};
  const interruption = new Promise<never>((_resolve, reject) => {
    abort = () => { controller.abort(); reject(abortError()); };
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(outputError('Voice request timed out.'));
    }, 10000);
    if (signal.aborted) abort();
  });
  try {
    return await Promise.race([
      interruption,
      (async () => {
        const response = await fetch('/api/tts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }), signal: controller.signal,
        });
        if (!response.ok) throw outputError('Voice service is unavailable.');
        const data = await response.json() as { audioContent?: unknown };
        if (typeof data.audioContent !== 'string' || !data.audioContent.trim()) {
          throw outputError('Voice service returned empty audio.');
        }
        return data.audioContent;
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export async function speakVoice(text: string, language: 'vi' | 'en', signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw abortError();
  const trimmed = text.trim();
  if (!trimmed) throw outputError('There is no text to speak.');
  if (language === 'vi') {
    try {
      const content = await requestAudio(trimmed, signal);
      await playAudio(content, trimmed, signal);
      return;
    } catch {
      if (signal.aborted) throw abortError();
    }
  }
  await browserSpeech(trimmed, language, signal);
}
