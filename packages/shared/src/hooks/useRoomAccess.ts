'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchRoomAccess, isRoomBlocked, type RoomAccessCheck } from '../lib/roomAccess';

export interface RoomAccessState {
  // True while the server is being asked about `roomCode`.
  isChecking: boolean;
  // The room may be used (server said ok, or could not answer — see isRoomBlocked).
  isAllowed: boolean;
  // Why the server refused, or null.
  blockedReason: Exclude<RoomAccessCheck, 'ok' | 'unavailable'> | null;
  // Record a code already checked elsewhere (e.g. a join form) to skip a second call.
  markAllowed: (roomCode: string) => void;
}

// Asks /api/room-access whether `roomCode` may be used (room exists, owner's
// subscription active). Re-checks when the code changes; null = nothing to check.
export function useRoomAccess(roomCode: string | null, baseUrl = ''): RoomAccessState {
  const [result, setResult] = useState<{ code: string; check: RoomAccessCheck } | null>(null);

  // Clearing the code forgets the answer, so asking about the same code again
  // re-checks (the subscription may have been renewed meanwhile). Adjusting
  // state during render on a prop change avoids an extra effect pass.
  const [prevCode, setPrevCode] = useState(roomCode);
  if (prevCode !== roomCode) {
    setPrevCode(roomCode);
    if (!roomCode && result) setResult(null);
  }

  useEffect(() => {
    if (!roomCode || result?.code === roomCode) return;
    let cancelled = false;
    void fetchRoomAccess(roomCode, baseUrl).then((check) => {
      if (!cancelled) setResult({ code: roomCode, check });
    });
    return () => {
      cancelled = true;
    };
  }, [roomCode, baseUrl, result]);

  const markAllowed = useCallback((code: string) => setResult({ code, check: 'ok' }), []);

  const check = roomCode && result?.code === roomCode ? result.check : null;
  const blockedReason = check && isRoomBlocked(check) ? check : null;
  return {
    isChecking: !!roomCode && check === null,
    isAllowed: check !== null && !blockedReason,
    blockedReason,
    markAllowed,
  };
}
