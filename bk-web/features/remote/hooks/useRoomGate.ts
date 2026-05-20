'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { RoomAccessReason } from '@/app/api/room-access/route';

const ROOM_CODE_PATTERN = /^\d{4,7}$/;

// Owns the URL ↔ room-code contract. `submitJoin` validates a code via the
// server-side /api/room-access route (checks room existence, subscription
// validity, and the owner's guestsAllowed toggle) before navigating to
// /?room=<code>. Room code lives in the URL only — refreshing keeps the user
// in the room, and Leave is irreversible without an explicit re-join.
export function useRoomGate() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawRoomCode = searchParams.get('room');
  const roomCode =
    rawRoomCode && ROOM_CODE_PATTERN.test(rawRoomCode) ? rawRoomCode : null;

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
        const res = await fetch(`/api/room-access?roomCode=${trimmed}`);
        const data = (await res.json()) as { allowed: boolean; reason: RoomAccessReason };
        if (!data.allowed) {
          setJoinError(data.reason);
          return;
        }
        router.push(`/?room=${trimmed}`);
      } catch {
        setJoinError('error');
      } finally {
        setIsJoining(false);
      }
    },
    [router],
  );

  const handleLeave = useCallback(() => {
    window.location.assign('/');
  }, []);

  return {
    rawRoomCode,
    roomCode,
    isCoarsePointer,
    joinError,
    isJoining,
    submitJoin,
    handleLeave,
  };
}
