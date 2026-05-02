'use client';

import { useCallback, type RefObject } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { arrayToRecord, type RoomState } from './types';

export function useRoomHistory(
  roomId: string | null,
  roomDataRef: RefObject<RoomState>,
) {
  // Append a YouTube videoId to playedHistory so the auto-random picker can
  // skip songs we've already pulled in this session.
  const addToPlayedHistory = useCallback(
    async (videoId: string) => {
      if (!roomId) return;
      const existing = roomDataRef.current.playedHistory;
      if (existing.includes(videoId)) return;
      const next = [...existing, videoId];
      await set(ref(db, `rooms/${roomId}/playedHistory`), arrayToRecord(next));
    },
    [roomId, roomDataRef],
  );

  return { addToPlayedHistory };
}
