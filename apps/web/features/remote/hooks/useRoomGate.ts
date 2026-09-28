'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRoomAccess } from '@bs-kara/shared/hooks';

const ROOM_CODE_PATTERN = /^\d{4,7}$/;

// Owns the URL ↔ room-code contract. One access check (useRoomAccess) covers
// both ways in: a room code in the URL (host link, QR code, shared link) and
// a code typed into the join form, which navigates once allowed. `roomCode`
// is exposed only after the check passes. Room code lives in the URL only —
// refreshing keeps the user in the room, and Leave is irreversible without an
// explicit re-join.
export function useRoomGate() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawRoomCode = searchParams.get('room');
  const urlRoomCode =
    rawRoomCode && ROOM_CODE_PATTERN.test(rawRoomCode) ? rawRoomCode : null;

  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const access = useRoomAccess(urlRoomCode ?? submittedCode);
  const fromForm = !urlRoomCode && !!submittedCode;

  // Join form: go to the room once its code is allowed. The URL code is the
  // same one, so the check is not repeated.
  useEffect(() => {
    if (fromForm && access.isAllowed) router.push(`/?room=${submittedCode}`);
  }, [fromForm, access.isAllowed, submittedCode, router]);

  const [isCoarsePointer, setIsCoarsePointer] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const submitJoin = useCallback((code: string) => {
    const trimmed = code.trim();
    if (ROOM_CODE_PATTERN.test(trimmed)) setSubmittedCode(trimmed);
  }, []);

  const handleLeave = useCallback(() => {
    window.location.assign('/');
  }, []);

  return {
    rawRoomCode,
    roomCode: urlRoomCode && access.isAllowed ? urlRoomCode : null,
    isCheckingRoom: !!urlRoomCode && access.isChecking,
    blockedReason: urlRoomCode ? access.blockedReason : null,
    isCoarsePointer,
    joinError: fromForm ? access.blockedReason : null,
    // Still checking, or allowed and navigating.
    isJoining: fromForm && (access.isChecking || access.isAllowed),
    submitJoin,
    handleLeave,
  };
}
