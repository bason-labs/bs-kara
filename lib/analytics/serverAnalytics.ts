import 'server-only';
import { getDatabase, ServerValue } from 'firebase-admin/database';
import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';
import { ptDateKey } from '@/lib/ptDateKey';

function adminDb() {
  return getDatabase(getAdminApp());
}

// All writes are fire-and-forget — analytics must never block a response.

export function recordSearchTotal(): void {
  const date = ptDateKey();
  void adminDb()
    .ref('/')
    .update({ [`analytics/searchCounts/${date}/total`]: ServerValue.increment(1) });
}

// Call only when tryAllKeys actually hit the YouTube API (cache miss).
// Also increments the quota counter since one API call = 100 quota units.
export function recordSearchLive(): void {
  const date = ptDateKey();
  void adminDb()
    .ref('/')
    .update({
      [`analytics/searchCounts/${date}/live`]: ServerValue.increment(1),
      [`analytics/youtubeQuota/${date}/calls`]: ServerValue.increment(1),
    });
}

export function recordQueueOp(roomId: string, action: 'add' | 'remove'): void {
  const date = ptDateKey();
  const field = action === 'add' ? 'adds' : 'removes';
  void adminDb()
    .ref(`analytics/queueOps/${roomId}/${date}/${field}`)
    .set(ServerValue.increment(1));
}
