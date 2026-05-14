import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from 'firebase-admin/database';
import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function adminDb() {
  return getDatabase(getAdminApp());
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400, headers: NO_STORE });
  }

  const roomId =
    typeof (body as { roomId?: unknown }).roomId === 'string'
      ? (body as { roomId: string }).roomId.trim()
      : '';
  if (!roomId) {
    return NextResponse.json({ error: 'missing_room_id' }, { status: 400, headers: NO_STORE });
  }

  const ip =
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const userAgent = req.headers.get('user-agent') ?? '';
  const deviceType: 'mobile' | 'desktop' = /Mobi|Android/i.test(userAgent)
    ? 'mobile'
    : 'desktop';

  try {
    const sessionRef = await adminDb().ref('analytics/sessions').push({
      ip,
      userAgent,
      deviceType,
      roomId,
      joinedAt: Date.now(),
      leftAt: null,
    });
    return NextResponse.json(
      { sessionId: sessionRef.key },
      { status: 200, headers: NO_STORE },
    );
  } catch (err) {
    console.error('[api/room/join] RTDB write failed:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
  }
}
