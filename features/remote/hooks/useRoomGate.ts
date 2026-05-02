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
  // Latched true by handleLeave so the auto-claim effect below stops
  // dragging the user back into the room they just chose to leave. In-memory
  // only — a full page reload (or scanning a new ?room= URL) clears it,
  // which is exactly the recovery surface we want. State, not a ref, would
  // force a re-render the effect doesn't need; the value is read at render
  // time on the post-`router.push('/')` re-render that already happens.
  const explicitlyLeftRef = useRef(false);
  // Render-time reset (not effect-time): the moment we see a ?room= back
  // in the URL, the consumer must read hasExplicitlyLeft=false on this
  // very render — otherwise RemoteClient would briefly see a stale "true"
  // immediately after rejoin. Same idempotent-mutation idiom as
  // `roomDataRef.current = roomData` in hooks/useRoom/subscribe.ts.
  /* eslint-disable react-hooks/refs -- intentional render-time reset; idempotent and observable on this render */
  if (rawRoomCode && explicitlyLeftRef.current) {
    explicitlyLeftRef.current = false;
  }
  /* eslint-enable react-hooks/refs */

  // Always subscribe — the not-found panel also needs to know whether
  // there's an active room so it can offer a "join the open party" shortcut.
  useEffect(() => {
    return subscribeActiveRoom((code) => {
      setActiveRoom(code);
      setPointerLoaded(true);
    });
  }, []);

  // Mobile-only auto-claim: a fresh tab on a phone with no `?room=` param
  // claims (or attaches to) the active room without making the user type
  // an OTP. The flow has three exits, in priority order:
  //   1. We already have a room (rawRoomCode set) → reset autoJoinStartedRef
  //      so a future Leave-then-rescan can re-arm the claim cleanly. The
  //      explicit-left latch is reset at render time above, not here.
  //   2. Desktop (fine pointer) → never auto-claim; the OTP form handles it.
  //   3. The user explicitly left → respect that. Don't reset
  //      autoJoinStartedRef either, otherwise a benign re-render here could
  //      flip the gate back open while we're still on `/`.
  // Anything else: fire the claim once and `router.replace` into the room.
  useEffect(() => {
    if (rawRoomCode) {
      autoJoinStartedRef.current = false;
      return;
    }
    if (!isCoarsePointer) {
      autoJoinStartedRef.current = false;
      return;
    }
    if (explicitlyLeftRef.current) return;
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
    // Set the latch first. Both the localStorage write and `router.push`
    // can trip listeners that race the auto-claim effect; if the ref isn't
    // already true when those effects re-run, mobile bounces straight back
    // into the room (the original bug).
    explicitlyLeftRef.current = true;
    localStorage.removeItem(STORAGE_KEY);
    router.push('/');
  }, [router]);

  // Drops the persisted code without navigating. Used when the URL points
  // at a stale room so leaving via the home button doesn't immediately
  // restore the bad code from localStorage.
  const forgetSavedRoom = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Read at render time on purpose. Updates to the underlying ref don't
  // re-render on their own, but every transition that matters here is
  // accompanied by a router push that does — by the time the consumer
  // observes this value, a fresh render has already captured it.
  /* eslint-disable react-hooks/refs -- intentional latch exposure; consumer reads on the post-`router.push` render */
  const hasExplicitlyLeft = explicitlyLeftRef.current;

  return {
    rawRoomCode,
    roomCode,
    activeRoom,
    pointerLoaded,
    isCoarsePointer,
    hasExplicitlyLeft,
    submitJoin,
    handleLeave,
    forgetSavedRoom,
  };
  /* eslint-enable react-hooks/refs */
}
