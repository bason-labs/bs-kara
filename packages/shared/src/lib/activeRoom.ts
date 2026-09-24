import { ref, set, remove, onDisconnect, onValue } from 'firebase/database';
import { db } from './firebase';
import { getActiveRoomPresencePath, getActiveRoomsPath } from './roomPaths';

export async function activateRoom(code: string): Promise<() => Promise<void>> {
  const presenceRef = ref(db, getActiveRoomPresencePath(code));
  await set(presenceRef, true);
  const disconnect = onDisconnect(presenceRef);
  await disconnect.remove();
  return async () => {
    disconnect.cancel().catch(() => {});
    await remove(presenceRef);
  };
}

export async function deactivateRoom(code: string): Promise<void> {
  await remove(ref(db, getActiveRoomPresencePath(code)));
}

export function subscribeActiveRooms(
  cb: (codes: string[]) => void,
): () => void {
  return onValue(ref(db, getActiveRoomsPath()), (snap) => {
    cb(snap.exists() ? Object.keys(snap.val() as Record<string, unknown>) : []);
  });
}
