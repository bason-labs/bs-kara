// All Firebase Realtime Database path strings live here.
//
// When migrating to multi-room, only this file and `claimOrGetActiveRoom`
// in `lib/activeRoom.ts` need to change — the singleton `meta/activeRoom`
// pointer goes away (replaced by per-code lookups), while `rooms/{code}`
// already matches the per-room shape we'll keep. Production callers must
// route every RTDB path through these helpers so that migration is a
// mechanical edit instead of a codebase-wide search.

// TODO(multi-room): the singleton active-room pointer disappears once we
// support concurrent rooms. The remaining caller (`claimOrGetActiveRoom`)
// will be replaced with per-code attach/create primitives at that point;
// this helper can be deleted then.
export const getActiveRoomPointerPath = (): string => 'meta/activeRoom';

export const getRoomDataPath = (roomCode: string): string =>
  `rooms/${roomCode}`;
