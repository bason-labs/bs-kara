'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { lookupUserByCode } from '@/lib/registeredUsers';

const ROOM_CODE_PATTERN = /^\d{4,7}$/;

// Owns the URL ↔ room-code contract: validates ?room= against the
// registeredUsers index via lookupUserByCode. Exposes submitJoin for the OTP
// form and handleLeave for the Leave Room action. Room code lives in the URL
// only — refreshing keeps the user in the room because the URL persists, and
// Leave is irreversible without an explicit re-join action. Joining always
// requires an explicit user gesture (scanning the TV's QR, tapping a shortcut,
// or entering the OTP) — there is no device-class auto-claim.
export function useRoomGate() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawRoomCode = searchParams.get('room');
  // The OTP form gates manual entry, but the `?room=` query param bypasses
  // it. Anything that isn't a 4–7 digit code is treated as no room so we
  // don't attempt a lookup on garbage input.
  const roomCode =
    rawRoomCode && ROOM_CODE_PATTERN.test(rawRoomCode) ? rawRoomCode : null;

  // Pointer detection still drives the brief skeleton the home page shows
  // before deciding what to render — kept post-mount so SSR and the first
  // client render agree (avoids a hydration mismatch when the server
  // returns false but the device is actually a phone).
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
        const user = await lookupUserByCode(trimmed);
        if (!user) {
          setJoinError('notFound');
          return;
        }
        if (user.suspended) {
          setJoinError('suspended');
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
    // Full page reload instead of router.push: Next.js App Router silently
    // no-ops push('/') when the user landed directly on /?room=… (the target
    // pathname is not in the client router cache and matches the current one,
    // only searchParams differ). A hard reload is deterministic, also tears
    // down the Firebase subscription and media state cleanly — desirable
    // semantics for "Leave Room".
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
