'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface VoiceSearchOptions {
  // BCP 47 language tag. Default vi-VN matches the original behavior.
  lang?: string;
  // Fired when the recognizer finalizes. Caller is expected to handle
  // setting query state and triggering the search.
  onFinal: (transcript: string) => void;
  // Fired once when SpeechRecognition is unavailable. Caller usually shows
  // an alert or toast here — kept as a callback so the hook stays free of
  // i18n concerns.
  onUnsupported: () => void;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Wraps the Web Speech API with start/stop sound cues, interim transcript
// state, and unmount cleanup. The recognizer reference is internal —
// callers only see {isListening, interimTranscript, start, stop}.
export function useVoiceSearch({
  lang = 'vi-VN',
  onFinal,
  onUnsupported,
}: VoiceSearchOptions) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const endAudioRef = useRef<HTMLAudioElement | null>(null);

  const playStartSound = useCallback(() => {
    if (!startAudioRef.current) startAudioRef.current = new Audio('/audio/pop.mp3');
    startAudioRef.current.currentTime = 0;
    startAudioRef.current.play().catch(() => {});
  }, []);

  const playEndSound = useCallback(() => {
    if (!endAudioRef.current) endAudioRef.current = new Audio('/audio/ding.mp3');
    endAudioRef.current.currentTime = 0;
    endAudioRef.current.play().catch(() => {});
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      onUnsupported();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    let endSoundPlayed = false;
    const playEndOnce = () => {
      if (!endSoundPlayed) {
        endSoundPlayed = true;
        playEndSound();
      }
    };

    recognition.onresult = (event) => {
      let interim = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (finalTranscript) {
        playEndOnce();
        setInterimTranscript('');
        setIsListening(false);
        onFinal(finalTranscript);
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = () => {
      playEndOnce();
      setIsListening(false);
    };

    recognition.onend = () => {
      playEndOnce();
      recognitionRef.current = null;
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    playStartSound();
    setInterimTranscript('');
    setIsListening(true);
    recognition.start();
  }, [lang, onFinal, onUnsupported, playEndSound, playStartSound]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    } else {
      setIsListening(false);
    }
    setInterimTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      if (startAudioRef.current) {
        startAudioRef.current.pause();
        startAudioRef.current = null;
      }
      if (endAudioRef.current) {
        endAudioRef.current.pause();
        endAudioRef.current = null;
      }
    };
  }, []);

  return { isListening, interimTranscript, start, stop };
}
