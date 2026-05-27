import {
  DEFAULT_RANDOM_FILTERS,
  type RandomFilters,
  type QueueItem,
  type YouTubeVideo,
} from '../../lib/youtube/types';

export interface RoomState {
  queue: QueueItem[];
  currentPlaying: YouTubeVideo | null;
  isPlaying: boolean;
  volume: number;
  history: YouTubeVideo[];
  isAutoRandomMode: boolean;
  randomFilters: RandomFilters;
  playedHistory: string[];
  dragDropEnabled: boolean;
  requesterPromptEnabled: boolean;
  isMCEnabled: boolean;
  // Google TTS voice id (from the Settings dropdown). Read by useMCPlayer
  // and forwarded to /api/tts. Falls back to the default if missing.
  mcVoice: string;
  // Cross-device announcement lock — devices race to write
  // currentPlaying.id here. The winner announces; losers see this already
  // matches and skip the MC. Persists across reconnects so a refresh of
  // the announcing device doesn't double up.
  lastAnnouncedSongId: string | null;
  // Per-room AI scoring toggle. Default false; flipping it ON does NOT
  // retroactively start scoring the song already playing — the toggle is
  // sampled at song-start by useSongScore.
  aiScoringEnabled: boolean;
  // Cross-device scoring lock — mirrors lastAnnouncedSongId. Devices race
  // to write currentPlaying.id here at onEnd; the winner persists the
  // ScoreRecord onto history[last].score and losers no-op.
  lastScoredSongId: string | null;
  // Set by the TV via Firebase onDisconnect presence; mobile uses this to
  // hide its now-playing card (the TV is already showing it).
  isTvActive: boolean;
  // Per-tab device id of the phone currently hosting the FullscreenPlayer
  // (i.e. acting as the playback surface when no TV is connected). Claimed
  // atomically and released via Firebase onDisconnect — see
  // useFullscreenOwnership. `null` means no phone owns the surface.
  fullscreenOwner: string | null;
  // Timestamp written by `resetRoom` (End Party). Phones watch this so they
  // can surface a "party ended" notice while staying connected to the room.
  lastEndedAt: number | null;
  // Firebase Auth UID of the registered host who owns this room.
  // null for legacy rooms created before host auth was introduced.
  hostUid: string | null;
  // Host-controlled permission: when true, guests may remove songs from the queue.
  guestCanRemove: boolean;
}

export const DEFAULT_STATE: RoomState = {
  queue: [],
  currentPlaying: null,
  isPlaying: true,
  volume: 100,
  history: [],
  isAutoRandomMode: false,
  randomFilters: DEFAULT_RANDOM_FILTERS,
  playedHistory: [],
  dragDropEnabled: true,
  requesterPromptEnabled: true,
  isMCEnabled: true,
  mcVoice: 'vi-VN-Neural2-A',
  lastAnnouncedSongId: null,
  aiScoringEnabled: false,
  lastScoredSongId: null,
  isTvActive: false,
  fullscreenOwner: null,
  lastEndedAt: null,
  hostUid: null,
  guestCanRemove: false,
};

// Firebase Realtime Database stores arrays as objects keyed by index. This
// helper produces the on-the-wire shape so writes round-trip through the
// snapshot reader (which already accepts both Record<string, T> and T[]).
export function arrayToRecord<T>(items: T[]): Record<number, T> {
  const out: Record<number, T> = {};
  items.forEach((item, i) => { out[i] = item; });
  return out;
}

export type GenerateMCForQueueItem = (
  currentRoomId: string,
  queueId: string,
  videoId: string,
  title: string,
  requesterName: string | null,
) => Promise<void>;
