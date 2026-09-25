import {
  useMCPlayer as useSharedMCPlayer,
  type UseMCPlayerArgs,
  type UseMCPlayerResult,
} from '@bs-kara/shared/hooks';
import { useAIVoice } from './useAIVoice';

// React Native has no implicit origin, so API calls need the web app's URL.
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

/** The shared MC announcer, speaking through expo-av (Google TTS) with expo-speech fallback. */
export function useMCPlayer(args: Omit<UseMCPlayerArgs, 'voice' | 'apiBase'>): UseMCPlayerResult {
  return useSharedMCPlayer({ ...args, voice: useAIVoice(), apiBase: API_BASE });
}
