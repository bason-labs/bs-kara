'use client';

import { useCallback, useEffect, useState } from 'react';
import { onDisconnect, ref, remove, set } from 'firebase/database';
import { db } from '@bs-kara/shared';
import { lookupUserByCode, lookupUserByPhone } from '@bs-kara/shared/registered-users';
import { getActiveRoomPresencePath, getRoomDataPath } from '@bs-kara/shared';
import { getPublicOrigin } from '@/lib/publicOrigin';
import { useRoomAccess } from '@bs-kara/shared/hooks';

const TV_ROOM_STORAGE_KEY = 'karaoke_tv_room';
const CODE_PATTERN = /^\d{4,7}$/;

// checking: /api/room-access is deciding; blocked: it refused (e.g. expired subscription).
export type TVPhase = 'lookup' | 'checking' | 'blocked' | 'active';

export function useTVPresence() {
  // The debug override skips the access check; any other code waits for it.
  const [fixedRoom, setFixedRoom] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<string | null>(null);
  const access = useRoomAccess(candidate);

  const phase: TVPhase = fixedRoom
    ? 'active'
    : !candidate
      ? 'lookup'
      : access.isChecking
        ? 'checking'
        : access.blockedReason
          ? 'blocked'
          : 'active';
  const roomCode = fixedRoom ?? (phase === 'active' ? candidate : null);
  const blockedReason = access.blockedReason;
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  // Remember an allowed room for re-attach; forget a refused one so a reload shows the lookup.
  useEffect(() => {
    if (!candidate || access.isChecking) return;
    if (access.isAllowed) sessionStorage.setItem(TV_ROOM_STORAGE_KEY, candidate);
    else sessionStorage.removeItem(TV_ROOM_STORAGE_KEY);
  }, [candidate, access.isChecking, access.isAllowed]);

  const backToLookup = useCallback(() => setCandidate(null), []);

  // Priority: env-var override (debug, unchecked) → ?room= URL param (fresh activation)
  // → sessionStorage (re-attach). All reads are post-mount to avoid SSR mismatch.
  useEffect(() => {
    const fixed = process.env.NEXT_PUBLIC_FIXED_ROOM_ID;
    const urlParam = new URLSearchParams(window.location.search).get('room');
    const code = urlParam && CODE_PATTERN.test(urlParam) ? urlParam : sessionStorage.getItem(TV_ROOM_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount read of browser-only state
    if (fixed) setFixedRoom(fixed);
    else if (code) setCandidate(code);
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

  // Called by TVRoomLookup after the code/phone resolved to a room.
  const activateRoomByCode = useCallback(async (code: string) => setCandidate(code), []);

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
