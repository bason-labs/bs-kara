import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from 'firebase-admin/database';
import { getAdminApp } from '@/server/firebaseAdmin';
import { checkRoomAccess } from '@/server/subscriptions/roomAccess';
import type { RoomAccessReason, RoomAccessResponse } from '@/lib/roomAccess';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function adminDb() {
  return getDatabase(getAdminApp());
}

function deny(reason: RoomAccessReason, status = 200): NextResponse {
  return NextResponse.json(
    { allowed: false, reason } satisfies RoomAccessResponse,
    { status, headers: NO_STORE },
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const roomCode = req.nextUrl.searchParams.get('roomCode');
  if (!roomCode || !/^\d{4,7}$/.test(roomCode)) {
    return deny('room_not_found', 400);
  }

  let db: ReturnType<typeof adminDb>;
  try {
    db = adminDb();
  } catch (err) {
    console.error('[api/room-access] admin SDK init failed:', err);
    return NextResponse.json(
      { allowed: false, reason: 'room_not_found' } satisfies RoomAccessResponse,
      { status: 503 },
    );
  }

  try {
    const reason = await checkRoomAccess(db, roomCode);
    if (reason !== 'ok') return deny(reason);

    return NextResponse.json(
      { allowed: true, reason: 'ok' } satisfies RoomAccessResponse,
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error('[api/room-access] RTDB read failed:', err);
    return NextResponse.json(
      { allowed: false, reason: 'room_not_found' } satisfies RoomAccessResponse,
      { status: 503 },
    );
  }
}
