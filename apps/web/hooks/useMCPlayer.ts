'use client';

import {
  useMCPlayer as useSharedMCPlayer,
  type UseMCPlayerArgs,
  type UseMCPlayerResult,
} from '@bs-kara/shared/hooks';
import { useAIVoice } from './useAIVoice';

/** The shared MC announcer, speaking through the browser (Google TTS via <audio>). */
export function useMCPlayer(args: Omit<UseMCPlayerArgs, 'voice' | 'apiBase'>): UseMCPlayerResult {
  return useSharedMCPlayer({ ...args, voice: useAIVoice() });
}
