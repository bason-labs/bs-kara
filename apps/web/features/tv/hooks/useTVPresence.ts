'use client';

import { useCallback, useEffect, useState } from 'react';
import { onDisconnect, ref, remove, set } from 'firebase/database';
import { db } from '@bs-kara/shared';
import { lookupUserByCode, lookupUserByPhone } from '@bs-kara/shared/registered-users';
import { getActiveRoomPresencePath, getRoomDataPath } from '@bs-kara/shared';
import { getPublicOrigin } from '@/lib/publicOrigin';
import { fetchRoomAccess, isRoomBlocked, type RoomAccessReason } from '@/lib/roomAccess';

const TV_ROOM_STORAGE_KEY = 'karaoke_tv_room';
const CODE_PATTERN = /^\d{4,7}$/;

// checking: /api/room-access is deciding; blocked: it refused (e.g. expired subscription).
export type TVPhase = 'lookup' | 'checking' | 'blocked' | 'active';

export function useTVPresence() {
  const [phase, setPhase] = useState<TVPhase>('lookup');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<RoomAccessReason | null>(null);

  // Every room goes live only after the server confirms it (room exists,
  // subscription active). A refused room is forgotten so a reload shows the lookup.
  const startRoom = useCallback(async (code: string) => {
    setPhase('checking');
    const result = await fetchRoomAccess(code);
    if (isRoomBlocked(result)) {
      sessionStorage.removeItem(TV_ROOM_STORAGE_KEY);
      setBlockedReason(result);
      setPhase('blocked');
      return;
    }
    sessionStorage.setItem(TV_ROOM_STORAGE_KEY, code);
    setRoomCode(code);
    setPhase('active');
  }, []);

  const backToLookup = useCallback(() => {
    setBlockedReason(null);
    setPhase('lookup');
  }, []);

  // Priority: env-var override (debug, unchecked) → ?room= URL param (fresh activation)
  // → sessionStorage (re-attach). All reads are post-mount to avoid SSR mismatch.
  useEffect(() => {
    const fixed = process.env.NEXT_PUBLIC_FIXED_ROOM_ID;
    if (fixed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoomCode(fixed);
      setPhase('active');
      return;
    }
    const urlParam = new URLSearchParams(window.location.search).get('room');
    const code = urlParam && CODE_PATTERN.test(urlParam) ? urlParam : sessionStorage.getItem(TV_ROOM_STORAGE_KEY);
    if (code) void startRoom(code);
  }, [startRoom]);

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

  // Called by TVRoomLookup after the code/phone resolved to a room.
  const activateRoomByCode = startRoom;

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

  return { phase, roomCode, joinUrl, blockedReason, activateRoomByCode, resolveRoomCode, backToLookup };
}
