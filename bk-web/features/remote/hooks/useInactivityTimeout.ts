'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '@bs-kara/shared';
import type { RoomAccessReason } from '@/app/api/room-access/route';

const DEFAULT_TIMEOUT_MINUTES = 60;
const CHECK_INTERVAL_MS = 60_000;
const STORAGE_KEY = 'karaoke_last_active';

export interface RejoinResult {
  ok: boolean;
  reason: RoomAccessReason;
}

export function useInactivityTimeout(roomCode: string | null) {
  const [timedOut, setTimedOut] = useState(false);
  const [rejoinReason, setRejoinReason] = useState<RoomAccessReason | null>(null);
  const timeoutMinutesRef = useRef<number>(DEFAULT_TIMEOUT_MINUTES);

  // Load admin-configured timeout setting once per room
  useEffect(() => {
    if (!roomCode) return;
    get(ref(db, 'meta/settings/sessionTimeoutMinutes'))
      .then((snap) => {
        if (snap.exists() && typeof snap.val() === 'number' && (snap.val() as number) > 0) {
          timeoutMinutesRef.current = snap.val() as number;
        }
      })
      .catch(() => {});
  }, [roomCode]);

  const resetActivity = useCallback(() => {
    if (!roomCode) return;
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    setTimedOut(false);
    setRejoinReason(null);
  }, [roomCode]);

  // Inactivity check interval — fires every minute
  useEffect(() => {
    if (!roomCode) return;

    if (!sessionStorage.getItem(STORAGE_KEY)) {
      sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    }

    const check = () => {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const lastActive = raw ? Number(raw) : Date.now();
      const elapsed = Date.now() - lastActive;
      if (elapsed > timeoutMinutesRef.current * 60 * 1000) {
        setTimedOut(true);
      }
    };

    check(); // catch stale sessions immediately without waiting for first interval
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [roomCode]);

  // Clear on room exit
  useEffect(() => {
    if (!roomCode) {
      setTimedOut(false);
      setRejoinReason(null);
    }
  }, [roomCode]);

  const rejoin = useCallback(async (): Promise<RejoinResult> => {
    if (!roomCode) return { ok: false, reason: 'room_not_found' };
    try {
      const res = await fetch(`/api/room-access?roomCode=${roomCode}`);
      const data = (await res.json()) as { allowed: boolean; reason: RoomAccessReason };
      if (data.allowed) {
        resetActivity();
        return { ok: true, reason: 'ok' };
      }
      setRejoinReason(data.reason);
      setTimedOut(true);
      return { ok: false, reason: data.reason };
    } catch {
      return { ok: false, reason: 'room_not_found' };
    }
  }, [roomCode, resetActivity]);

  return { timedOut, rejoinReason, resetActivity, rejoin };
}
