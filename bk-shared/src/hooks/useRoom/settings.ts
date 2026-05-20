import { useCallback, type RefObject } from 'react';
import { ref, push, remove, set, update } from 'firebase/database';
import { db } from '../../lib/firebase';
import { getRoomDataPath } from '../../lib/roomPaths';
import type { RandomFilters } from '../../lib/youtube/types';
import type { RoomState } from './types';

export function useRoomSettings(
  roomId: string | null,
  roomDataRef: RefObject<RoomState>,
) {
  // Soft reset: drops everything that's "playable state" (queue, current song,
  // history, played-history) but keeps the room itself, the active-room
  // pointer, and per-room settings (auto-random / drag-drop / MC / etc.).
  // Used by the TV's "End Party" button so connected phones stay attached
  // and a fresh round can start without re-claiming a code.
  const resetRoom = useCallback(async () => {
    if (!roomId) return;
    await Promise.all([
      remove(ref(db, `${getRoomDataPath(roomId)}/queue`)),
      remove(ref(db, `${getRoomDataPath(roomId)}/currentPlaying`)),
      remove(ref(db, `${getRoomDataPath(roomId)}/history`)),
      remove(ref(db, `${getRoomDataPath(roomId)}/playedHistory`)),
      remove(ref(db, `${getRoomDataPath(roomId)}/isPlaying`)),
      // Marker for connected phones — they compare against the last seen
      // value and pop a "party ended" toast when this jumps forward.
      set(ref(db, `${getRoomDataPath(roomId)}/lastEndedAt`), Date.now()),
    ]);
  }, [roomId]);

  const setAutoRandomMode = useCallback(
    (enabled: boolean) => {
      if (!roomId) return;
      set(ref(db, `${getRoomDataPath(roomId)}/isAutoRandomMode`), enabled);
    },
    [roomId],
  );

  const setRandomFilters = useCallback(
    (filters: Partial<RandomFilters>) => {
      if (!roomId) return;
      const current = roomDataRef.current.randomFilters;
      update(ref(db, `${getRoomDataPath(roomId)}/randomFilters`), {
        type: filters.type ?? current.type,
        tone: filters.tone ?? current.tone,
        genre: filters.genre ?? current.genre,
      });
    },
    [roomId, roomDataRef],
  );

  const setDragDropEnabled = useCallback(
    (enabled: boolean) => {
      if (!roomId) return;
      set(ref(db, `${getRoomDataPath(roomId)}/dragDropEnabled`), enabled);
    },
    [roomId],
  );

  const setRequesterPromptEnabled = useCallback(
    (enabled: boolean) => {
      if (!roomId) return;
      set(ref(db, `${getRoomDataPath(roomId)}/requesterPromptEnabled`), enabled);
    },
    [roomId],
  );

  const setMCEnabled = useCallback(
    (enabled: boolean) => {
      if (!roomId) return;
      set(ref(db, `${getRoomDataPath(roomId)}/isMCEnabled`), enabled);
    },
    [roomId],
  );

  const setAiScoringEnabled = useCallback(
    (enabled: boolean) => {
      if (!roomId) return;
      set(ref(db, `${getRoomDataPath(roomId)}/aiScoringEnabled`), enabled);
    },
    [roomId],
  );

  const setMcVoice = useCallback(
    (voice: string) => {
      if (!roomId) return;
      if (!voice) return;
      set(ref(db, `${getRoomDataPath(roomId)}/mcVoice`), voice);
    },
    [roomId],
  );

  const setGuestCanRemove = useCallback(
    (enabled: boolean) => {
      if (!roomId) return;
      set(ref(db, `${getRoomDataPath(roomId)}/guestCanRemove`), enabled);
    },
    [roomId],
  );

  const sendEmoji = useCallback(
    (emoji: string) => {
      if (!roomId) return;
      push(ref(db, `${getRoomDataPath(roomId)}/emojis`), { emoji, timestamp: Date.now() });
    },
    [roomId],
  );

  return {
    resetRoom,
    setAutoRandomMode,
    setRandomFilters,
    setDragDropEnabled,
    setRequesterPromptEnabled,
    setMCEnabled,
    setAiScoringEnabled,
    setMcVoice,
    setGuestCanRemove,
    sendEmoji,
  };
}
