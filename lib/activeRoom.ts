import { ref, runTransaction, onValue } from 'firebase/database';
import { db } from './firebase';
import { getActiveRoomPointerPath } from './roomPaths';

function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// TODO(multi-room): see docs/architecture-decisions.md ADR-001 for migration plan
// atomically returns the active room code, claiming a
// new one if none is set. Once we support concurrent rooms, the singleton
// pointer goes away — callers should resolve a room directly by code (or
// create-by-code) instead of relying on a single global slot. Replace
// this with per-code attach/create primitives at that point.
//
// Atomically returns the active room code, claiming a new one if none is set.
// Two callers racing here will agree on whichever value committed first.
export async function claimOrGetActiveRoom(): Promise<string> {
  const candidate = generateRoomCode();
  const result = await runTransaction(
    ref(db, getActiveRoomPointerPath()),
    (current) => {
      if (current === null || current === undefined) return candidate;
      return; // abort: keep existing
    },
  );
  return result.snapshot.val() as string;
}

// Only clears the pointer if it still matches `code`, so a fresh party started
// by someone else isn't accidentally wiped out.
export async function clearActiveRoomIfMatches(code: string): Promise<void> {
  await runTransaction(ref(db, getActiveRoomPointerPath()), (current) => {
    if (current === code) return null;
    return;
  });
}

export function subscribeActiveRoom(cb: (code: string | null) => void): () => void {
  return onValue(ref(db, getActiveRoomPointerPath()), (snap) => {
    cb(snap.exists() ? (snap.val() as string) : null);
  });
}
