import { NextResponse } from 'next/server';
import { getDatabase } from 'firebase-admin/database';
import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';
import {
  requireAdmin,
  AdminAuthError,
} from '@/features/admin/lib/requireAdmin';
import { ptDateKey } from '@/lib/ptDateKey';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const DAYS_TO_SHOW = 30;

export interface SearchDay {
  date: string; // YYYYMMDD PT
  total: number; // all successful GET handler calls
  live: number; // calls that hit the YouTube API (cache miss)
  cached: number; // max(0, total - live)
}

export interface SearchStatsSnapshot {
  days: SearchDay[];
}

interface RtdbSearchCount {
  total?: number;
  live?: number;
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
    snap = await adminDb().ref('analytics/searchCounts').once('value');
  } catch (err) {
    console.error('[api/admin/search-stats] RTDB read failed:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
  }

  const rtdbVal: Record<string, RtdbSearchCount> =
    (snap.val() as Record<string, RtdbSearchCount> | null) ?? {};

  const days: SearchDay[] = Array.from({ length: DAYS_TO_SHOW }, (_, i) => {
    const date = ptDateKey(DAYS_TO_SHOW - 1 - i);
    const raw = rtdbVal[date] ?? {};
    const total = raw.total ?? 0;
    const live = raw.live ?? 0;
    return { date, total, live, cached: Math.max(0, total - live) };
  });

  return NextResponse.json({ days } satisfies SearchStatsSnapshot, {
    status: 200,
    headers: NO_STORE,
  });
}
