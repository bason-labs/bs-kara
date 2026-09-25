import type { YouTubeVideo } from '@bs-kara/shared';

export type VoiceLanguage = 'vi' | 'en';
export interface VoiceSessionCredentials {
  sessionId: string;
  token: string;
}
export interface VoiceResults {
  searchId: string;
  videos: YouTubeVideo[];
}
export interface VoiceReceipt {
  status: 'queued' | 'started';
  video: YouTubeVideo;
}
export interface VoiceTurnResponse {
  reply: string;
  clearResults?: boolean;
  results?: VoiceResults;
  receipt?: VoiceReceipt;
}
export interface VoiceTurnRequest {
  sessionId: string;
  requestId: string;
  text?: string;
  selection?: { searchId: string; position: number };
}
export interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  results?: VoiceResults;
  receipt?: VoiceReceipt;
}
