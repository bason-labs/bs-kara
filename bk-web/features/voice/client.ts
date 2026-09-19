import { auth } from '@bs-kara/shared';
import type { VoiceLanguage, VoiceSessionCredentials, VoiceTurnRequest, VoiceTurnResponse } from './types';

export class VoiceRequestError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

async function responseBody<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new VoiceRequestError(typeof body.error === 'string' ? body.error : 'network', response.status);
  return body as T;
}

export async function createVoiceSession(roomCode: string, language: VoiceLanguage, signal: AbortSignal) {
  const idToken = await auth.currentUser?.getIdToken();
  return responseBody<VoiceSessionCredentials>(await fetch('/api/voice/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ roomCode, language, ...(idToken ? { idToken } : {}) }),
  }));
}
export async function sendVoiceTurn(session: VoiceSessionCredentials, body: VoiceTurnRequest, signal: AbortSignal) {
  return responseBody<VoiceTurnResponse>(await fetch('/api/voice/turn', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(body),
  }));
}
export async function transcribeVoice(session: VoiceSessionCredentials, audio: Blob, signal: AbortSignal) {
  const form = new FormData();
  form.set('sessionId', session.sessionId);
  form.set('audio', audio, audio.type.includes('mp4') ? 'voice.mp4' : audio.type.includes('ogg') ? 'voice.ogg' : 'voice.webm');
  const body = await responseBody<{ text: string }>(await fetch('/api/voice/transcribe', {
    method: 'POST', signal, headers: { Authorization: `Bearer ${session.token}` }, body: form,
  }));
  return body.text;
}
