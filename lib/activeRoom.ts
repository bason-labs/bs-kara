import { ref, runTransaction, get, onValue } from 'firebase/database';
import { db } from './firebase';

const ACTIVE_ROOM_PATH = 'meta/activeRoom';

function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Atomically returns the active room code, claiming a new one if none is set.
// Two callers racing here will agree on whichever value committed first.
export async function claimOrGetActiveRoom(): Promise<string> {
  const candidate = generateRoomCode();
  const result = await runTransaction(ref(db, ACTIVE_ROOM_PATH), (current) => {
    if (current === null || current === undefined) return candidate;
    return; // abort: keep existing
  });
  return result.snapshot.val() as string;
}

export async function getActiveRoom(): Promise<string | null> {
  const snap = await get(ref(db, ACTIVE_ROOM_PATH));
  return snap.exists() ? (snap.val() as string) : null;
}

// Only clears the pointer if it still matches `code`, so a fresh party started
// by someone else isn't accidentally wiped out.
export async function clearActiveRoomIfMatches(code: string): Promise<void> {
  await runTransaction(ref(db, ACTIVE_ROOM_PATH), (current) => {
    if (current === code) return null;
    return;
  });
}

export function subscribeActiveRoom(cb: (code: string | null) => void): () => void {
  return onValue(ref(db, ACTIVE_ROOM_PATH), (snap) => {
    cb(snap.exists() ? (snap.val() as string) : null);
  });
}
