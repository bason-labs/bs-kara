import { NextResponse } from 'next/server';
import { getDatabase } from 'firebase-admin/database';
import { ptDateKey } from '@bs-kara/shared';
import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';
import {
  requireAdmin,
  AdminAuthError,
} from '@/features/admin/lib/requireAdmin';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export interface QuotaDay {
  date: string;  // YYYYMMDD in PT timezone
  calls: number;
}

export interface YoutubeQuotaSnapshot {
  days: QuotaDay[];
  dailyLimitCalls: number;
}

const DAILY_LIMIT_CALLS = 100; // 10,000 units / 100 units per search
const DAYS_TO_SHOW = 30;

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
    snap = await adminDb().ref('analytics/youtubeQuota').once('value');
  } catch (err) {
    console.error('[api/admin/quota/youtube] RTDB read failed:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
  }

  const rtdbVal: Record<string, { calls?: number }> =
    (snap.val() as Record<string, { calls?: number }> | null) ?? {};

  // Generate last DAYS_TO_SHOW date keys oldest → newest
  const days: QuotaDay[] = Array.from({ length: DAYS_TO_SHOW }, (_, i) => {
    const date = ptDateKey(DAYS_TO_SHOW - 1 - i);
    return { date, calls: rtdbVal[date]?.calls ?? 0 };
  });

  const result: YoutubeQuotaSnapshot = { days, dailyLimitCalls: DAILY_LIMIT_CALLS };
  return NextResponse.json(result, { status: 200, headers: NO_STORE });
}
