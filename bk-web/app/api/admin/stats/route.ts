import { NextResponse } from 'next/server';
import { getDatabase } from 'firebase-admin/database';
import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';
import {
  requireAdmin,
  AdminAuthError,
} from '@/features/admin/lib/requireAdmin';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export interface RoomRow {
  roomId: string;
  queueDepth: number;
  hasTv: boolean;
  currentSong: string | null;
  lastEndedAt: number | null;
}

export interface StatsSnapshot {
  totalRooms: number;
  activeTvRooms: number;
  totalQueueDepth: number;
  rooms: RoomRow[];
}

interface RtdbRoom {
  isTvActive?: boolean;
  queue?: Record<string, unknown>;
  currentPlaying?: { title?: string } | null;
  lastEndedAt?: number | null;
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
    snap = await adminDb().ref('rooms').once('value');
  } catch (err) {
    console.error('[api/admin/stats] RTDB read failed:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
  }

  const roomsVal: Record<string, RtdbRoom> =
    (snap.val() as Record<string, RtdbRoom> | null) ?? {};

  const rows: RoomRow[] = Object.entries(roomsVal).map(([roomId, room]) => ({
    roomId,
    queueDepth: Object.keys(room.queue ?? {}).length,
    hasTv: room.isTvActive === true,
    currentSong: room.currentPlaying?.title ?? null,
    lastEndedAt: room.lastEndedAt ?? null,
  }));

  const snapshot: StatsSnapshot = {
    totalRooms: rows.length,
    activeTvRooms: rows.filter((r) => r.hasTv).length,
    totalQueueDepth: rows.reduce((sum, r) => sum + r.queueDepth, 0),
    rooms: rows,
  };

  return NextResponse.json(snapshot, { status: 200, headers: NO_STORE });
}
