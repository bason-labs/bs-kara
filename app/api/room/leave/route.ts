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

  const sessionId =
    typeof (body as { sessionId?: unknown }).sessionId === 'string'
      ? (body as { sessionId: string }).sessionId.trim()
      : '';
  if (!sessionId) {
    return NextResponse.json({ error: 'missing_session_id' }, { status: 400, headers: NO_STORE });
  }

  try {
    await adminDb().ref(`analytics/sessions/${sessionId}/leftAt`).set(Date.now());
    return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
  } catch (err) {
    console.error('[api/room/leave] RTDB write failed:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
  }
}
