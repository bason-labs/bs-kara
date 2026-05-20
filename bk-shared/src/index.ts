// Firebase
export { db, auth } from './lib/firebase';

// Firebase room helpers
export { activateRoom, deactivateRoom, subscribeActiveRooms } from './lib/activeRoom';
export {
  getRoomDataPath,
  getRegisteredUsersPath,
  getRegisteredUserPath,
  getRoomCodeIndexPath,
  getRoomCodeIndexEntryPath,
  getActiveRoomsPath,
  getActiveRoomPresencePath,
} from './lib/roomPaths';
export { resetRoom } from './lib/resetRoom';

// Utilities
export { DEFAULT_HOT_HITS_QUERY } from './lib/config';
export { REACTIONS, getGifUrl, getStaticUrl } from './lib/reactions';
export { ptDateKey } from './lib/ptDateKey';
export { normalizeDiacritics } from './lib/text/normalize';

// Random / auto-random
export {
  buildRandomSearchQuery,
  pickBestVideo,
  pickRandomTitle,
} from './lib/random/picker';
export * from './lib/random/songPools';

// Types
export type {
  YouTubeVideo,
  QueueItem,
  RandomFilters,
  SingerType,
  Tone,
  Genre,
  SearchError,
  SearchResult,
} from './lib/youtube/types';
export { DEFAULT_RANDOM_FILTERS } from './lib/youtube/types';

// Scoring
export * from './lib/scoring';

// i18n
export { default as i18n } from './lib/i18n';

// Locales (for consumers that need the raw JSON)
export { default as localeEn } from './locales/en.json';
export { default as localeVi } from './locales/vi.json';

// Hooks
export { useRoom } from './hooks/useRoom';
export type { RoomState } from './hooks/useRoom/types';
export { useTransientNotice } from './hooks/useTransientNotice';
