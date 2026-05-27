import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { Audio } from 'expo-av';

// @react-native-voice/voice requires a native dev build — not available in Expo Go.
// Load it lazily so the app still runs when the native module is absent.
let Voice: typeof import('@react-native-voice/voice').default | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Voice = require('@react-native-voice/voice').default as typeof import('@react-native-voice/voice').default;
} catch {
  Voice = null;
}

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
    if (!Voice) return;
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
        sound.unloadAsync().catch(() => {});
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
      void Voice!.destroy();
      Voice!.removeAllListeners();
    };
  }, []);

  const start = useCallback(async () => {
    if (!Voice) {
      onUnsupportedRef.current();
      return;
    }
    const available = await Voice.isAvailable();
    if (!available) {
      onUnsupportedRef.current();
      return;
    }
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        onUnsupportedRef.current();
        return;
      }
    }
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/audio/pop.mp3')
      );
      await sound.playAsync();
      sound.unloadAsync().catch(() => {});
    } catch {}
    try {
      await Voice.start('vi-VN');
      setIsListening(true);
      setInterimTranscript('');
    } catch {
      onUnsupportedRef.current();
    }
  }, []);

  const stop = useCallback(() => {
    Voice?.stop().catch(() => {});
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  return { isListening, interimTranscript, start, stop };
}
