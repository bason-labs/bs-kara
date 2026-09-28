// Contract and client call for GET /api/room-access (web route), shared by the
// web remote, the TV and the mobile app.
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

// `baseUrl` is the web app's origin; empty on the web itself (same origin).
export async function fetchRoomAccess(roomCode: string, baseUrl = ''): Promise<RoomAccessCheck> {
  try {
    const res = await fetch(`${baseUrl}/api/room-access?roomCode=${encodeURIComponent(roomCode)}`);
    if (res.status >= 500) return 'unavailable';
    const data = (await res.json()) as RoomAccessResponse;
    return data.allowed ? 'ok' : data.reason;
  } catch {
    return 'unavailable';
  }
}

// i18n keys (shared locales, `roomAccess.*`) for why a room can't be used, so
// every screen says the same thing. The owner gets "renew" wording.
export function roomAccessMessage(
  reason: Exclude<RoomAccessCheck, 'ok'>,
  { isOwner = false }: { isOwner?: boolean } = {},
): { title: string; hint: string } {
  const key =
    reason === 'room_not_found'
      ? 'notFound'
      : reason === 'subscription_expired'
        ? isOwner ? 'ownerExpired' : 'expired'
        : 'unavailable';
  return { title: `roomAccess.${key}`, hint: `roomAccess.${key}Hint` };
}

// A server hiccup must not lock a running party out of its room, so only a clear
// "no" from the server blocks.
export function isRoomBlocked(check: RoomAccessCheck): check is Exclude<RoomAccessReason, 'ok'> {
  return check !== 'ok' && check !== 'unavailable';
}
