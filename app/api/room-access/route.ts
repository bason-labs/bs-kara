import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from 'firebase-admin/database';
import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';
import {
  getRoomCodeIndexEntryPath,
  getRegisteredUserPath,
  getRoomDataPath,
} from '@/lib/roomPaths';
import { byPhoneRoot, subscriptionPath } from '@/lib/subscriptions/paths';

export const dynamic = 'force-dynamic';

export type RoomAccessReason =
  | 'ok'
  | 'room_not_found'
  | 'subscription_expired'
  | 'guests_not_allowed';

export interface RoomAccessResponse {
  allowed: boolean;
  reason: RoomAccessReason;
}

function adminDb() {
  return getDatabase(getAdminApp());
}

function deny(reason: RoomAccessReason, status = 200): NextResponse {
  return NextResponse.json({ allowed: false, reason } satisfies RoomAccessResponse, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const roomCode = req.nextUrl.searchParams.get('roomCode');
  if (!roomCode || !/^\d{4,7}$/.test(roomCode)) {
    return deny('room_not_found', 400);
  }

  const db = adminDb();

  // 1. Resolve room code → normalizedPhone
  const indexSnap = await db.ref(getRoomCodeIndexEntryPath(roomCode)).once('value');
  if (!indexSnap.exists()) return deny('room_not_found');
  const normalizedPhone = indexSnap.val() as string;

  // 2. Verify user is not suspended
  const userSnap = await db.ref(getRegisteredUserPath(normalizedPhone)).once('value');
  if (!userSnap.exists()) return deny('room_not_found');
  const userData = userSnap.val() as { suspended?: boolean };
  if (userData.suspended === true) return deny('room_not_found');

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
  if (!hasActiveSubscription) return deny('subscription_expired');

  // 4. Check guestsAllowed toggle
  const guestsSnap = await db
    .ref(`${getRoomDataPath(roomCode)}/guestsAllowed`)
    .once('value');
  if (guestsSnap.val() !== true) return deny('guests_not_allowed');

  return NextResponse.json({ allowed: true, reason: 'ok' } satisfies RoomAccessResponse);
}
