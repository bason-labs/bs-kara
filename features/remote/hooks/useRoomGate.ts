'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { claimOrGetActiveRoom, subscribeActiveRoom } from '@/lib/activeRoom';

const ROOM_CODE_PATTERN = /^\d{4}$/;
const STORAGE_KEY = 'karaoke_client_room';

// Owns the URL ↔ room-code contract: validates ?room=, persists the active
// room across reloads, restores it on a bare /, subscribes to the global
// active-room pointer for shortcut/auto-join, and detects coarse-pointer
// devices so mobile auto-claims while desktop keeps the OTP form.
export function useRoomGate() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawRoomCode = searchParams.get('room');
  // The OTP form gates manual entry, but the `?room=` query param bypasses
  // it. Anything that isn't a 4-digit code is treated as no room (and the
  // URL is cleaned up in the effect below) so we don't subscribe to a
  // garbage Firebase path or render the shell with bogus data.
  const roomCode =
    rawRoomCode && ROOM_CODE_PATTERN.test(rawRoomCode) ? rawRoomCode : null;

  // Persist the current room code so a fresh tab can restore it on first
  // load. Runs whenever the URL settles on a valid room.
  useEffect(() => {
    if (roomCode) {
      localStorage.setItem(STORAGE_KEY, roomCode);
    }
  }, [roomCode]);

  // Restore the last valid saved code only on the initial mount with a bare
  // `/` URL. Doing this on every navigation to `/` would trap the user: once
  // they Back out of a room, the effect would immediately redirect them
  // straight back into it.
  const restoreCheckedRef = useRef(false);
  useEffect(() => {
    if (restoreCheckedRef.current) return;
    restoreCheckedRef.current = true;
    if (rawRoomCode) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ROOM_CODE_PATTERN.test(saved)) {
      router.replace(`/?room=${saved}`);
    } else if (saved) {
      // Clear garbage that may have been persisted before validation existed.
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [rawRoomCode, router]);

  // Mobile devices skip the OTP form entirely: they auto-join whichever room
  // the TV (or a previous phone) has already claimed, or claim a new one if
  // nobody has yet. Desktops keep the OTP form but get a shortcut button when
  // a pointer is live. Resolved post-mount so SSR and the first client render
  // agree (avoids a hydration mismatch when the server returns false but the
  // device is actually a phone).
  const [isCoarsePointer, setIsCoarsePointer] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [pointerLoaded, setPointerLoaded] = useState(false);
  const autoJoinStartedRef = useRef(false);

  // Always subscribe — the not-found panel also needs to know whether
  // there's an active room so it can offer a "join the open party" shortcut.
  useEffect(() => {
    return subscribeActiveRoom((code) => {
      setActiveRoom(code);
      setPointerLoaded(true);
    });
  }, []);

  useEffect(() => {
    // Gate on rawRoomCode so a malformed `?room=` value still keeps us on
    // the not-found panel instead of silently auto-joining the active room.
    // When we *do* have a room (or aren't on a coarse pointer), reset the
    // ref so a later "end party" → bounce back to `/` triggers a fresh
    // claim instead of stranding mobile on the spinner forever.
    if (rawRoomCode || !isCoarsePointer) {
      autoJoinStartedRef.current = false;
      return;
    }
    if (autoJoinStartedRef.current) return;
    autoJoinStartedRef.current = true;
    let cancelled = false;
    (async () => {
      const code = await claimOrGetActiveRoom();
      if (cancelled) return;
      router.replace(`/?room=${code}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [rawRoomCode, isCoarsePointer, router]);

  // Joining is gated by the active-room pointer: a code is only accepted if
  // it matches the room currently in `meta/activeRoom`. This prevents users
  // from typing a random 4-digit code and silently landing in an empty,
  // never-created room.
  const submitJoin = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (trimmed.length !== 4) return;
      if (!activeRoom || trimmed !== activeRoom) return;
      router.push(`/?room=${trimmed}`);
    },
    [router, activeRoom],
  );

  const handleLeave = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    router.push('/');
  }, [router]);

  // Drops the persisted code without navigating. Used when the URL points
  // at a stale room so leaving via the home button doesn't immediately
  // restore the bad code from localStorage.
  const forgetSavedRoom = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    rawRoomCode,
    roomCode,
    activeRoom,
    pointerLoaded,
    isCoarsePointer,
    submitJoin,
    handleLeave,
    forgetSavedRoom,
  };
}
