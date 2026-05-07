import type { ScoreRecord } from '@/lib/scoring';

export interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  // Singer's name attached when the song was added to the queue. Optional
  // because search results don't have one and auto-random picks bypass the
  // requester prompt entirely.
  requesterName?: string;
  // Pre-generated AI MC line. We fire the API call at add-time so the line
  // is ready by the time the song reaches the top, removing the awkward
  // gap between the previous song ending and the MC starting to talk.
  mcText?: string;
  // AI scoring result frozen at natural song-end. Only populated on the
  // /history array (not on /queue or /currentPlaying). Absent when the
  // toggle is off, when the song was skipped, or when reaction signal
  // never crossed the threshold.
  score?: ScoreRecord;
}

export interface QueueItem extends YouTubeVideo {
  queueId: string;
}

export type SingerType = 'all' | 'solo' | 'duet';
export type Tone = 'all' | 'male' | 'female';
export type Genre = 'all' | 'bolero' | 'caco' | 'tre';

export interface RandomFilters {
  type: SingerType;
  tone: Tone;
  genre: Genre;
}

export const DEFAULT_RANDOM_FILTERS: RandomFilters = {
  type: 'all',
  tone: 'all',
  genre: 'all',
};

export type SearchError = 'quota' | 'generic';

export interface SearchResult {
  videos: YouTubeVideo[];
  error?: SearchError;
}
