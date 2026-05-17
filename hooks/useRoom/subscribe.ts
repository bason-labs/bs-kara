'use client';

import { useEffect, useRef, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { getRoomDataPath } from '@/lib/roomPaths';
import type {
  QueueItem,
  RandomFilters,
  YouTubeVideo,
} from '@/lib/youtube/types';
import { DEFAULT_STATE, type RoomState } from './types';

export function useRoomSubscribe(roomId: string | null) {
  const [roomData, setRoomData] = useState<RoomState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(false);
  // null while we haven't heard back from Firebase yet, true/false after the
  // first snapshot. Lets the UI distinguish "still loading" from "missing".
  const [roomExists, setRoomExists] = useState<boolean | null>(null);
  // Ref so write functions always see fresh state without stale closure issues.
  const roomDataRef = useRef(roomData);
  // eslint-disable-next-line react-hooks/refs -- intentional state mirror; mutation hooks read latest synchronously
  roomDataRef.current = roomData;

  useEffect(() => {
    if (!roomId) {
      // Tear-down transition when the parent drops to no-room. Cannot be a
      // derive-during-render because callers rely on these values actually
      // settling across the unmount/remount boundary.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- transition reset on key prop change
      setRoomData(DEFAULT_STATE);
      setIsLoading(false);
      setRoomExists(null);
      return;
    }

    // Instantly clear stale data and show loading state when room changes
    setRoomData(DEFAULT_STATE);
    setIsLoading(true);
    setRoomExists(null);

    const roomRef = ref(db, getRoomDataPath(roomId));
    const unsub = onValue(roomRef, (snapshot) => {
      const data = snapshot.val() as {
        queue?: Record<string, Omit<QueueItem, 'queueId'>>;
        currentPlaying?: YouTubeVideo;
        isPlaying?: boolean;
        volume?: number;
        history?: Record<string, YouTubeVideo>;
        isAutoRandomMode?: boolean;
        randomFilters?: Partial<RandomFilters>;
        playedHistory?: Record<string, string> | string[];
        dragDropEnabled?: boolean;
        requesterPromptEnabled?: boolean;
        isMCEnabled?: boolean;
        mcVoice?: string;
        // Legacy field — read for backwards-compat with rooms created
        // before the rename, never written.
        isAImcEnabled?: boolean;
        lastAnnouncedSongId?: string | null;
        aiScoringEnabled?: boolean;
        lastScoredSongId?: string | null;
        isTvActive?: boolean;
        fullscreenOwner?: string | null;
        lastEndedAt?: number | null;
        guestsAllowed?: boolean;
        hostUid?: string | null;
        guestCanRemove?: boolean;
      } | null;

      if (!data) {
        setRoomData(DEFAULT_STATE);
        setIsLoading(false);
        setRoomExists(false);
        return;
      }

      setRoomExists(true);

      const queue: QueueItem[] = data.queue
        ? Object.entries(data.queue).map(([key, item]) => ({ ...item, queueId: key }))
        : [];

      const history: YouTubeVideo[] = data.history
        ? Object.entries(data.history)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([, item]) => item)
        : [];

      const playedHistory: string[] = Array.isArray(data.playedHistory)
        ? data.playedHistory.filter((v): v is string => typeof v === 'string')
        : data.playedHistory
          ? Object.values(data.playedHistory).filter(
              (v): v is string => typeof v === 'string',
            )
          : [];

      setRoomData({
        queue,
        currentPlaying: data.currentPlaying ?? null,
        isPlaying: data.isPlaying !== undefined ? data.isPlaying : true,
        volume: data.volume !== undefined ? data.volume : 100,
        history,
        isAutoRandomMode: data.isAutoRandomMode === true,
        randomFilters: {
          type: data.randomFilters?.type ?? 'all',
          tone: data.randomFilters?.tone ?? 'all',
          genre: data.randomFilters?.genre ?? 'all',
        },
        playedHistory,
        // Default to enabled when the field is missing — existing rooms
        // shouldn't lose drag-and-drop just because they predate this setting.
        dragDropEnabled: data.dragDropEnabled !== false,
        // Same default-on pattern: rooms that predate this setting still
        // get the singer-name prompt unless explicitly turned off.
        requesterPromptEnabled: data.requesterPromptEnabled !== false,
        // Default on for feature discoverability — hosts hear the MC the
        // first time around and can disable it from settings if they don't
        // want it. Read the new field, falling back to the legacy name so
        // pre-rename rooms keep their existing setting.
        isMCEnabled:
          data.isMCEnabled !== undefined
            ? data.isMCEnabled !== false
            : data.isAImcEnabled !== false,
        mcVoice:
          typeof data.mcVoice === 'string' && data.mcVoice
            ? data.mcVoice
            : 'vi-VN-Neural2-A',
        lastAnnouncedSongId:
          typeof data.lastAnnouncedSongId === 'string'
            ? data.lastAnnouncedSongId
            : null,
        // Default off — only opt-in rooms see scoring UI.
        aiScoringEnabled: data.aiScoringEnabled === true,
        lastScoredSongId:
          typeof data.lastScoredSongId === 'string'
            ? data.lastScoredSongId
            : null,
        isTvActive: data.isTvActive === true,
        fullscreenOwner:
          typeof data.fullscreenOwner === 'string' && data.fullscreenOwner
            ? data.fullscreenOwner
            : null,
        lastEndedAt:
          typeof data.lastEndedAt === 'number' ? data.lastEndedAt : null,
        guestsAllowed: data.guestsAllowed === true,
        hostUid:
          typeof data.hostUid === 'string' && data.hostUid
            ? data.hostUid
            : null,
        guestCanRemove: data.guestCanRemove === true,
      });
      setIsLoading(false);
    });
    return unsub;
  }, [roomId]);

  return { roomData, isLoading, roomExists, roomDataRef };
}
