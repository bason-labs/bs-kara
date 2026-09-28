// Response contract of GET /api/room-access, shared by the route and the phone/TV hooks.
export type RoomAccessReason =
  | 'ok'
  | 'room_not_found'
  | 'subscription_expired';

export interface RoomAccessResponse {
  allowed: boolean;
  reason: RoomAccessReason;
}

// 'unavailable' = network error or server failure (5xx): the server could not decide.
export type RoomAccessCheck = RoomAccessReason | 'unavailable';

// Client-side call to GET /api/room-access.
export async function fetchRoomAccess(roomCode: string): Promise<RoomAccessCheck> {
  try {
    const res = await fetch(`/api/room-access?roomCode=${roomCode}`);
    if (res.status >= 500) return 'unavailable';
    const data = (await res.json()) as RoomAccessResponse;
    return data.allowed ? 'ok' : data.reason;
  } catch {
    return 'unavailable';
  }
}

// A server hiccup must not lock a running party out of its room, so only a clear
// "no" from the server blocks.
export function isRoomBlocked(check: RoomAccessCheck): check is Exclude<RoomAccessReason, 'ok'> {
  return check !== 'ok' && check !== 'unavailable';
}
