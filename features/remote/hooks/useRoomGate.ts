'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { subscribeActiveRoom } from '@/lib/activeRoom';

const ROOM_CODE_PATTERN = /^\d{4}$/;
const STORAGE_KEY = 'karaoke_client_room';

// Owns the URL ↔ room-code contract: validates ?room=, persists the active
// room across reloads, restores it on a bare /, and subscribes to the
// global active-room pointer so JoinForm can offer a "join the open party"
// shortcut. Joining always requires an explicit user gesture (scanning the
// TV's QR, tapping the shortcut, or entering the OTP) — there is no
// device-class auto-claim. Earlier versions auto-claimed on coarse-pointer
// devices, which made tapping Leave on a phone visually do nothing because
// the same effect re-claimed the still-live TV room within milliseconds.
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
  // straight back into it. handleLeave clears localStorage before navigating,
  // so an explicit Leave + reload lands on the JoinForm, not back in the room.
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

  // Pointer detection still drives the brief skeleton the home page shows
  // before deciding what to render — kept post-mount so SSR and the first
  // client render agree (avoids a hydration mismatch when the server
  // returns false but the device is actually a phone).
  const [isCoarsePointer, setIsCoarsePointer] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [pointerLoaded, setPointerLoaded] = useState(false);

  // Subscription powers JoinForm's "Tham gia phòng đang mở" shortcut button
  // — it lights up as soon as the TV (or another phone) claims a room.
  useEffect(() => {
    return subscribeActiveRoom((code) => {
      setActiveRoom(code);
      setPointerLoaded(true);
    });
  }, []);

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
