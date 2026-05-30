import { useCallback, useEffect, useRef, useState } from 'react';
import { ref, get } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@bs-kara/shared';

const DEFAULT_TIMEOUT_MINUTES = 60;
const CHECK_INTERVAL_MS = 60_000;
const STORAGE_KEY = 'karaoke_last_active';
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export type RoomAccessReason =
  | 'ok'
  | 'room_not_found'
  | 'subscription_expired'
  | 'guests_not_allowed';

export interface RejoinResult {
  ok: boolean;
  reason: RoomAccessReason;
}

export function useInactivityTimeout(roomCode: string | null): {
  timedOut: boolean;
  rejoinReason: RoomAccessReason | null;
  resetActivity: () => void;
  rejoin: () => Promise<RejoinResult>;
} {
  const [timedOut, setTimedOut] = useState(false);
  const [rejoinReason, setRejoinReason] = useState<RoomAccessReason | null>(null);
  const timeoutMinutesRef = useRef<number>(DEFAULT_TIMEOUT_MINUTES);

  // Load admin-configured timeout setting once per room.
  useEffect(() => {
    if (!roomCode) return;
    get(ref(db, 'meta/settings/sessionTimeoutMinutes'))
      .then((snap) => {
        if (
          snap.exists() &&
          typeof snap.val() === 'number' &&
          (snap.val() as number) > 0
        ) {
          timeoutMinutesRef.current = snap.val() as number;
        }
      })
      .catch(() => {});
  }, [roomCode]);

  // resetActivity writes the current timestamp to AsyncStorage (async/await
  // required; no synchronous sessionStorage in React Native).
  const resetActivity = useCallback(() => {
    if (!roomCode) return;
    void AsyncStorage.setItem(STORAGE_KEY, String(Date.now()));
    setTimedOut(false);
    setRejoinReason(null);
  }, [roomCode]);

  // Inactivity check interval — fires every minute.
  // On first mount, initialise the lastActive key if missing (async read).
  useEffect(() => {
    if (!roomCode) return;

    let cancelled = false;

    // Async bootstrap: read existing value, write now if absent.
    AsyncStorage.getItem(STORAGE_KEY).then((existing) => {
      if (!cancelled && !existing) {
        void AsyncStorage.setItem(STORAGE_KEY, String(Date.now()));
      }
    });

    const check = async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const lastActive = raw ? Number(raw) : Date.now();
      const elapsed = Date.now() - lastActive;
      if (!cancelled && elapsed > timeoutMinutesRef.current * 60 * 1000) {
        setTimedOut(true);
      }
    };

    // Catch stale sessions immediately without waiting for the first interval.
    void check();
    const id = setInterval(() => void check(), CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [roomCode]);

  // Clear state when the user leaves the room entirely.
  useEffect(() => {
    if (!roomCode) {
      setTimedOut(false);
      setRejoinReason(null);
    }
  }, [roomCode]);

  const rejoin = useCallback(async (): Promise<RejoinResult> => {
    if (!roomCode) return { ok: false, reason: 'room_not_found' };
    try {
      const res = await fetch(
        `${API_BASE}/api/room-access?roomCode=${roomCode}`,
      );
      const data = (await res.json()) as {
        allowed: boolean;
        reason: RoomAccessReason;
      };
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
