'use client';

import { useEffect, useMemo } from 'react';
import { VoiceConversation } from '@/features/voice/conversation';
import { createVoiceSession, sendVoiceTurn, transcribeVoice } from '@/features/voice/client';
import { captureVoice, primeVoiceAudio, speakVoice } from '@/features/voice/audio';
import type { VoiceLanguage } from '@/features/voice/types';

export function useVoiceConversation(roomCode: string | null, language: VoiceLanguage, onActivity: () => void) {
  const conversation = useMemo(() => new VoiceConversation({
    createSession: signal => createVoiceSession(roomCode ?? '', language, signal),
    capture: captureVoice,
    transcribe: transcribeVoice,
    turn: (session, body, signal) => { onActivity(); return sendVoiceTurn(session, body, signal); },
    speak: (text, signal) => speakVoice(text, language, signal),
    prime: primeVoiceAudio,
    id: () => crypto.randomUUID(),
  }), [roomCode, language, onActivity]);
  useEffect(() => () => conversation.stop(), [conversation]);
  return conversation;
}
