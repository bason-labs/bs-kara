// lib/roomPaths.ts
// All Firebase Realtime Database path strings live here.

export const getRoomDataPath = (roomCode: string): string =>
  `rooms/${roomCode}`;

export const getRegisteredUsersPath = (): string => 'registeredUsers';

export const getRegisteredUserPath = (normalizedPhone: string): string =>
  `registeredUsers/${normalizedPhone}`;

export const getRoomCodeIndexPath = (): string => 'roomCodeIndex';

export const getRoomCodeIndexEntryPath = (code: string): string =>
  `roomCodeIndex/${code}`;

export const getActiveRoomsPath = (): string => 'meta/activeRooms';

export const getActiveRoomPresencePath = (code: string): string =>
  `meta/activeRooms/${code}`;
