'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransientNotice } from '@bs-kara/shared/hooks';

interface UseRoomNoticesArgs {
  roomCode: string | null;
  // The URL points at a room that can't be entered (bad code, or one Firebase says doesn't exist).
  roomMissing: boolean;
  // True once this room's first Firebase snapshot has arrived (useRoom's roomExists === true).
  roomLoaded: boolean;
  lastEndedAt: number | null | undefined;
  handleLeave: () => void;
}

// Transient toasts about the room itself: it doesn't exist (drops the user
// back to home) or the TV just ended the party. Returns the current notice.
export function useRoomNotices({ roomCode, roomMissing, roomLoaded, lastEndedAt, handleLeave }: UseRoomNoticesArgs) {
  const { t } = useTranslation();
  const { notice, show: showNotice } = useTransientNotice(4000);

  // When the TV ends the party (or the URL points at a stale/bad code), drop
  // back to home and surface a toast so the user understands why.
  useEffect(() => {
    if (!roomMissing) return;
    showNotice(t('errors.roomNotFound.message'));
    handleLeave();
  }, [roomMissing, handleLeave, showNotice, t]);

  // End-Party toast: the TV writes `lastEndedAt` when it resets the room.
  // Each room's first loaded snapshot seeds the marker, so historical resets
  // (or rejoining after the fact) don't fire the toast — only forward jumps
  // that happen while we're connected do. The seed is dropped whenever the
  // room isn't loaded, so a room switch re-seeds from the new room's first
  // snapshot instead of comparing against the previous room's value.
  const seenRef = useRef<{ roomCode: string | null; value: number | null } | null>(null);
  useEffect(() => {
    if (!roomLoaded) {
      seenRef.current = null;
      return;
    }
    const seen = seenRef.current;
    if (!seen || seen.roomCode !== roomCode) {
      seenRef.current = { roomCode, value: lastEndedAt ?? null };
      return;
    }
    if (lastEndedAt && lastEndedAt !== seen.value) {
      seen.value = lastEndedAt;
      showNotice(t('tv.endPartyNotice'));
    }
  }, [roomLoaded, roomCode, lastEndedAt, showNotice, t]);

  return notice;
}
