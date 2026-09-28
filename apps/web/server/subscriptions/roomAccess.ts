import 'server-only';
import type { Database } from 'firebase-admin/database';
import {
  getRoomCodeIndexEntryPath,
  getRegisteredUserPath,
} from '@bs-kara/shared';
import type { RoomAccessReason } from '@/lib/roomAccess';
import { isSubscriptionLive } from '@/lib/subscriptions/expiry';
import { byPhoneRoot, subscriptionPath } from './paths';

const MAX_SUBSCRIPTIONS_PER_PHONE = 100;

/**
 * Whether a room code may be joined: the code must map to a registered, non-suspended
 * user who holds a live subscription (isSubscriptionLive). Used by /api/room-access
 * and the voice service. RTDB errors propagate to the caller.
 */
export async function checkRoomAccess(
  db: Database,
  roomCode: string,
  now: number = Date.now(),
): Promise<RoomAccessReason> {
  const read = async (path: string) => (await db.ref(path).once('value')).val() as unknown;

  // 1. Resolve room code → normalizedPhone ('84XXXXXXXXX')
  const phone = await read(getRoomCodeIndexEntryPath(roomCode));
  if (typeof phone !== 'string') return 'room_not_found';

  // 2. Verify user exists and is not suspended
  const user = (await read(getRegisteredUserPath(phone))) as { suspended?: boolean } | null;
  if (!user || user.suspended === true) return 'room_not_found';

  // 3. Any live subscription? subscriptionsByPhone uses '+84XXXXXXXXX'.
  const index = await read(byPhoneRoot('+' + phone));
  const ids = index && typeof index === 'object' ? Object.keys(index) : [];
  if (ids.length === 0 || ids.length > MAX_SUBSCRIPTIONS_PER_PHONE) return 'subscription_expired';
  const subs = await Promise.all(ids.map((id) => read(subscriptionPath(id))));
  const live = subs.some((s) => isSubscriptionLive(s as Parameters<typeof isSubscriptionLive>[0], now));
  return live ? 'ok' : 'subscription_expired';
}
