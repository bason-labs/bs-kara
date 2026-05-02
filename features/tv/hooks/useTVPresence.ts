'use client';

import { useEffect, useState } from 'react';
import { onDisconnect, ref, remove, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { claimOrGetActiveRoom } from '@/lib/activeRoom';

const TV_ROOM_STORAGE_KEY = 'karaoke_tv_room';

// Owns the TV's room-claim handshake plus the `isTvActive` Firebase
// presence flag. Returns the active roomCode (null until claimed) and the
// /?room=<code> URL used by the QR code.
//
// Presence note: we `remove` rather than `set(false)` on cleanup or
// disconnect. If the room was just nuked (End Party), `set` would re-create
// the node as `{ isTvActive: false }`, leaving a zombie room. `remove` is
// a no-op when the path is gone, and otherwise drops the field — phones
// treat the missing field as "TV not active" anyway.
export function useTVPresence() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  // Claim (or attach to) the active room on mount. Re-runs if roomCode is
  // ever cleared back to null elsewhere — the original effect was written
  // with that future possibility in mind.
  useEffect(() => {
    if (roomCode) return;
    let cancelled = false;
    (async () => {
      const fixed = process.env.NEXT_PUBLIC_FIXED_ROOM_ID;
      if (fixed) {
        if (!cancelled) setRoomCode(fixed);
        return;
      }
      // Defer to the shared active-room pointer so a phone can start a party
      // before the TV is on, and the TV will attach to whatever's already live.
      const id = await claimOrGetActiveRoom();
      if (cancelled) return;
      localStorage.setItem(TV_ROOM_STORAGE_KEY, id);
      setRoomCode(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  // Computed in an effect (not at render time) because window.location.origin
  // is browser-only — running it during render produces a hydration mismatch
  // (SSR sees null, client sees a URL). Same idiomatic mount-once pattern as
  // `setIsCoarsePointer` in useRoomGate.
  useEffect(() => {
    if (!roomCode) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJoinUrl(`${window.location.origin}/?room=${roomCode}`);
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;
    const presenceRef = ref(db, `rooms/${roomCode}/isTvActive`);
    set(presenceRef, true).catch(() => {});
    const disconnect = onDisconnect(presenceRef);
    disconnect.remove().catch(() => {});
    return () => {
      disconnect.cancel().catch(() => {});
      remove(presenceRef).catch(() => {});
    };
  }, [roomCode]);

  return { roomCode, joinUrl };
}
