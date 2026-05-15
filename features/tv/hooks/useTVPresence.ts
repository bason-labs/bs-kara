'use client';

import { useCallback, useEffect, useState } from 'react';
import { onDisconnect, ref, remove, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { lookupUserByCode, lookupUserByPhone } from '@/lib/registeredUsers';
import { getActiveRoomPresencePath, getRoomDataPath } from '@/lib/roomPaths';
import { getPublicOrigin } from '@/lib/publicOrigin';

const TV_ROOM_STORAGE_KEY = 'karaoke_tv_room';
const CODE_PATTERN = /^\d{4,7}$/;

export type TVPhase = 'lookup' | 'active';

export function useTVPresence() {
  const [phase, setPhase] = useState<TVPhase>('lookup');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  // Re-attach to a previously-activated room stored in localStorage.
  useEffect(() => {
    const fixed = process.env.NEXT_PUBLIC_FIXED_ROOM_ID;
    if (fixed) {
      // Post-mount only — reading localStorage during render causes SSR mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoomCode(fixed);
      setPhase('active');
      return;
    }
    const stored = localStorage.getItem(TV_ROOM_STORAGE_KEY);
    if (stored) {
      setRoomCode(stored);
      setPhase('active');
    }
  }, []);

  // Compute joinUrl once roomCode is known (post-mount to avoid SSR mismatch).
  useEffect(() => {
    if (!roomCode) return;
    const origin = getPublicOrigin() ?? window.location.origin;
    // Post-mount: getPublicOrigin() reads window.location which isn't available during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJoinUrl(`${origin}/?room=${roomCode}`);
  }, [roomCode]);

  // isTvActive + meta/activeRooms presence: write on activate, remove on cleanup/disconnect.
  // Inline rather than using activateRoom() because React useEffect cleanup must be sync.
  useEffect(() => {
    if (!roomCode || phase !== 'active') return;

    const isTvRef = ref(db, `${getRoomDataPath(roomCode)}/isTvActive`);
    set(isTvRef, true).catch(() => {});
    const tvDisc = onDisconnect(isTvRef);
    tvDisc.remove().catch(() => {});

    const activeRef = ref(db, getActiveRoomPresencePath(roomCode));
    set(activeRef, true).catch(() => {});
    const activeDisc = onDisconnect(activeRef);
    activeDisc.remove().catch(() => {});

    return () => {
      tvDisc.cancel().catch(() => {});
      remove(isTvRef).catch(() => {});
      activeDisc.cancel().catch(() => {});
      remove(activeRef).catch(() => {});
    };
  }, [roomCode, phase]);

  // Called by TVRoomLookup after successful validation.
  const activateRoomByCode = useCallback(async (code: string) => {
    await set(ref(db, `${getRoomDataPath(code)}/guestsAllowed`), false).catch(() => {});
    localStorage.setItem(TV_ROOM_STORAGE_KEY, code);
    setRoomCode(code);
    setPhase('active');
  }, []);

  const setGuestsAllowed = useCallback(
    (enabled: boolean) => {
      if (!roomCode) return;
      set(ref(db, `${getRoomDataPath(roomCode)}/guestsAllowed`), enabled).catch(() => {});
    },
    [roomCode],
  );

  // Used by TVRoomLookup to validate the operator's input.
  // Accepts either a room code (4-7 digits) or a phone number.
  const resolveRoomCode = useCallback(async (input: string): Promise<string | null> => {
    const trimmed = input.trim();
    if (CODE_PATTERN.test(trimmed)) {
      const byCode = await lookupUserByCode(trimmed);
      if (byCode && !byCode.suspended) return byCode.roomCode;
    }
    // Try as phone number (normalizePhone handles the format conversion internally).
    try {
      const byPhone = await lookupUserByPhone(trimmed);
      if (byPhone && !byPhone.suspended) return byPhone.roomCode;
    } catch {
      // not a valid phone input — fall through
    }
    return null;
  }, []);

  return { phase, roomCode, joinUrl, activateRoomByCode, resolveRoomCode, setGuestsAllowed };
}
