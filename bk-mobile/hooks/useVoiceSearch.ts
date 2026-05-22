import { useCallback, useEffect, useRef, useState } from 'react';
import Voice from '@react-native-voice/voice';
import { Audio } from 'expo-av';

interface UseVoiceSearchOptions {
  onFinal: (transcript: string) => void;
  onUnsupported: () => void;
}

interface UseVoiceSearchResult {
  isListening: boolean;
  interimTranscript: string;
  start: () => Promise<void>;
  stop: () => void;
}

export function useVoiceSearch({ onFinal, onUnsupported }: UseVoiceSearchOptions): UseVoiceSearchResult {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const onFinalRef = useRef(onFinal);
  const onUnsupportedRef = useRef(onUnsupported);
  onFinalRef.current = onFinal;
  onUnsupportedRef.current = onUnsupported;

  useEffect(() => {
    Voice.onSpeechPartialResults = (e) => {
      setInterimTranscript(e.value?.[0] ?? '');
    };
    // @ts-ignore — handler returns Promise but Voice typedef expects sync
    Voice.onSpeechResults = async (e: { value?: string[] }) => {
      const text = e.value?.[0] ?? '';
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/audio/ding.mp3')
        );
        await sound.playAsync();
      } catch {}
      onFinalRef.current(text);
      setIsListening(false);
      setInterimTranscript('');
    };
    Voice.onSpeechError = () => {
      setIsListening(false);
      setInterimTranscript('');
    };
    return () => {
      void Voice.destroy();
      Voice.removeAllListeners();
    };
  }, []);

  const start = useCallback(async () => {
    const available = await Voice.isAvailable();
    if (!available) {
      onUnsupportedRef.current();
      return;
    }
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/audio/pop.mp3')
      );
      await sound.playAsync();
    } catch {}
    await Voice.start('vi-VN');
    setIsListening(true);
    setInterimTranscript('');
  }, []);

  const stop = useCallback(() => {
    void Voice.stop();
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  return { isListening, interimTranscript, start, stop };
}
