import { NextResponse } from 'next/server';
import { getDatabase } from 'firebase-admin/database';
import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';
import { requireAdmin, AdminAuthError } from '@/features/admin/lib/requireAdmin';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const SESSION_LIMIT = 200;

export interface SessionRecord {
  sessionId: string;
  ip: string;
  userAgent: string;
  deviceType: 'mobile' | 'desktop';
  roomId: string;
  joinedAt: number;
  leftAt: number | null;
}

interface RtdbSession {
  ip?: string;
  userAgent?: string;
  deviceType?: string;
  roomId?: string;
  joinedAt?: number;
  leftAt?: number | null;
}

function adminDb() {
  return getDatabase(getAdminApp());
}

function unauth(err: unknown): NextResponse | null {
  if (err instanceof AdminAuthError) {
    return NextResponse.json({ error: err.code }, { status: 401, headers: NO_STORE });
  }
  return null;
}

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch (err) {
    const r = unauth(err);
    if (r) return r;
    throw err;
  }

  let snap;
  try {
    snap = await adminDb()
      .ref('analytics/sessions')
      .orderByChild('joinedAt')
      .limitToLast(SESSION_LIMIT)
      .once('value');
  } catch (err) {
    console.error('[api/admin/sessions] RTDB read failed:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
  }

  const raw: Record<string, RtdbSession> =
    (snap.val() as Record<string, RtdbSession> | null) ?? {};

  const sessions: SessionRecord[] = Object.entries(raw)
    .map(([sessionId, s]) => ({
      sessionId,
      ip: s.ip ?? 'unknown',
      userAgent: s.userAgent ?? '',
      deviceType: (s.deviceType === 'mobile' ? 'mobile' : 'desktop') as 'mobile' | 'desktop',
      roomId: s.roomId ?? '',
      joinedAt: s.joinedAt ?? 0,
      leftAt: s.leftAt ?? null,
    }))
    .sort((a, b) => b.joinedAt - a.joinedAt);

  return NextResponse.json({ sessions }, { status: 200, headers: NO_STORE });
}
