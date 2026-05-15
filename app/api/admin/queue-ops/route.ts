import { NextResponse } from 'next/server';
import { getDatabase } from 'firebase-admin/database';
import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';
import { requireAdmin, AdminAuthError } from '@/features/admin/lib/requireAdmin';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export interface RoomQueueOps {
  roomId: string;
  adds: number;
  removes: number;
}

export interface QueueOpsSnapshot {
  rooms: RoomQueueOps[];
  totalAdds: number;
  totalRemoves: number;
}

type RtdbDateBucket = { adds?: number; removes?: number };
type RtdbRoomOps = Record<string, RtdbDateBucket>;
type RtdbQueueOps = Record<string, RtdbRoomOps>;

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
    snap = await adminDb().ref('analytics/queueOps').once('value');
  } catch (err) {
    console.error('[api/admin/queue-ops] RTDB read failed:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
  }

  const rtdbVal: RtdbQueueOps =
    (snap.val() as RtdbQueueOps | null) ?? {};

  const rooms: RoomQueueOps[] = Object.entries(rtdbVal).map(([roomId, dateBuckets]) => {
    let adds = 0;
    let removes = 0;
    for (const bucket of Object.values(dateBuckets)) {
      adds += bucket.adds ?? 0;
      removes += bucket.removes ?? 0;
    }
    return { roomId, adds, removes };
  });

  const totalAdds = rooms.reduce((s, r) => s + r.adds, 0);
  const totalRemoves = rooms.reduce((s, r) => s + r.removes, 0);

  return NextResponse.json(
    { rooms, totalAdds, totalRemoves } satisfies QueueOpsSnapshot,
    { status: 200, headers: NO_STORE },
  );
}
