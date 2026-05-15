import { ref, remove, set } from 'firebase/database';
import { db } from './firebase';
import { getRoomDataPath } from './roomPaths';

export async function resetRoom(code: string): Promise<void> {
  const base = getRoomDataPath(code);
  await Promise.all([
    remove(ref(db, `${base}/queue`)),
    remove(ref(db, `${base}/currentPlaying`)),
    remove(ref(db, `${base}/history`)),
    remove(ref(db, `${base}/playedHistory`)),
    remove(ref(db, `${base}/isPlaying`)),
    remove(ref(db, `${base}/lastAnnouncedSongId`)),
    set(ref(db, `${base}/lastEndedAt`), Date.now()),
  ]);
}
