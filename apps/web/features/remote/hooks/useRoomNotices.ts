'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransientNotice } from '@bs-kara/shared/hooks';

interface UseRoomNoticesArgs {
  roomCode: string | null;
  // The URL points at a room that can't be entered (bad code, or one Firebase says doesn't exist).
  roomMissing: boolean;
  lastEndedAt: number | null | undefined;
  handleLeave: () => void;
}

// Transient toasts about the room itself: it doesn't exist (drops the user
// back to home) or the TV just ended the party. Returns the current notice.
export function useRoomNotices({ roomCode, roomMissing, lastEndedAt, handleLeave }: UseRoomNoticesArgs) {
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
  // We seed the ref with whatever value Firebase reports on the first
  // snapshot so historical resets (or rejoining after the fact) don't
  // re-trigger the toast — only forward jumps that happen while we're
  // connected fire the notice.
  const lastEndedSeenRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const value = lastEndedAt;
    if (lastEndedSeenRef.current === undefined) {
      lastEndedSeenRef.current = value;
      return;
    }
    if (value && value !== lastEndedSeenRef.current) {
      lastEndedSeenRef.current = value;
      showNotice(t('tv.endPartyNotice'));
    }
  }, [lastEndedAt, showNotice, t]);

  // Reset the seen marker when the room changes so a fresh subscribe
  // re-seeds against the new room's history instead of replaying it.
  useEffect(() => {
    lastEndedSeenRef.current = undefined;
  }, [roomCode]);

  return notice;
}
