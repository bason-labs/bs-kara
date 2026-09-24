import 'server-only';
import type { Database } from 'firebase-admin/database';
import {
  getRoomCodeIndexEntryPath,
  getRegisteredUserPath,
} from '@bs-kara/shared';
import type { RoomAccessReason } from '@/lib/roomAccess';
import { byPhoneRoot, subscriptionPath } from './paths';

/**
 * Whether a room code may be joined: the code must map to a registered, non-suspended
 * user who holds an active, unexpired subscription. RTDB errors propagate to the caller.
 */
export async function checkRoomAccess(db: Database, roomCode: string): Promise<RoomAccessReason> {
  // 1. Resolve room code → normalizedPhone
  const indexSnap = await db.ref(getRoomCodeIndexEntryPath(roomCode)).once('value');
  if (!indexSnap.exists()) return 'room_not_found';
  const rawPhone = indexSnap.val();
  if (typeof rawPhone !== 'string') return 'room_not_found';
  const normalizedPhone = rawPhone;

  // 2. Verify user is not suspended
  const userSnap = await db.ref(getRegisteredUserPath(normalizedPhone)).once('value');
  if (!userSnap.exists()) return 'room_not_found';
  const userData = userSnap.val() as { suspended?: boolean };
  if (userData.suspended === true) return 'room_not_found';

  // 3. Check for an active, non-expired subscription
  // registeredUsers stores '84XXXXXXXXX'; subscriptionsByPhone uses '+84XXXXXXXXX'
  const phoneE164 = '+' + normalizedPhone;
  const subIndexSnap = await db.ref(byPhoneRoot(phoneE164)).once('value');
  let hasActiveSubscription = false;
  if (subIndexSnap.exists()) {
    const ids = Object.keys(subIndexSnap.val() as Record<string, unknown>);
    const now = Date.now();
    const subSnaps = await Promise.all(
      ids.map((id) => db.ref(subscriptionPath(id)).once('value')),
    );
    hasActiveSubscription = subSnaps.some((snap) => {
      if (!snap.exists()) return false;
      const s = snap.val() as { status?: string; endDate?: number };
      return s.status === 'active' && typeof s.endDate === 'number' && s.endDate >= now;
    });
  }
  if (!hasActiveSubscription) return 'subscription_expired';

  return 'ok';
}
