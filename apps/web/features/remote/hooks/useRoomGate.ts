'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRoomAccess } from '@bs-kara/shared/hooks';
import { fetchRoomAccess } from '@bs-kara/shared/room-access';

const ROOM_CODE_PATTERN = /^\d{4,7}$/;

// Owns the URL ↔ room-code contract. Every room code in the URL (host link,
// QR code, shared link, `submitJoin`) is checked via /api/room-access (room
// existence and subscription validity) before `roomCode` is exposed. Room code
// lives in the URL only — refreshing keeps the user in the room, and Leave is
// irreversible without an explicit re-join.
export function useRoomGate() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawRoomCode = searchParams.get('room');
  const urlRoomCode =
    rawRoomCode && ROOM_CODE_PATTERN.test(rawRoomCode) ? rawRoomCode : null;

  const { isChecking: isCheckingRoom, isAllowed, blockedReason, markAllowed } = useRoomAccess(urlRoomCode);
  const roomCode = isAllowed ? urlRoomCode : null;

  const [isCoarsePointer, setIsCoarsePointer] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const submitJoin = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!ROOM_CODE_PATTERN.test(trimmed)) return;
      setJoinError(null);
      setIsJoining(true);
      try {
        const result = await fetchRoomAccess(trimmed);
        if (result === 'unavailable') {
          setJoinError('error');
          return;
        }
        if (result !== 'ok') {
          setJoinError(result);
          return;
        }
        markAllowed(trimmed); // already checked; skip a second check after navigating
        router.push(`/?room=${trimmed}`);
      } finally {
        setIsJoining(false);
      }
    },
    [router, markAllowed],
  );

  const handleLeave = useCallback(() => {
    window.location.assign('/');
  }, []);

  return {
    rawRoomCode,
    roomCode,
    isCheckingRoom,
    blockedReason,
    isCoarsePointer,
    joinError,
    isJoining,
    submitJoin,
    handleLeave,
  };
}
