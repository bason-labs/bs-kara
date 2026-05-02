'use client';

import { useCallback, type RefObject } from 'react';
import { ref, push, remove, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { getRoomDataPath } from '@/lib/roomPaths';
import type { QueueItem, YouTubeVideo } from '@/lib/youtube/types';
import { arrayToRecord, type GenerateMCForQueueItem, type RoomState } from './types';

// All queue / now-playing mutations. Reads fresh state via roomDataRef so
// rapid callers don't race a stale closure.
export function useRoomQueue(
  roomId: string | null,
  roomDataRef: RefObject<RoomState>,
  generateMCForQueueItem: GenerateMCForQueueItem,
) {
  const addSongToQueue = useCallback(
    (item: YouTubeVideo, requesterName?: string | null) => {
      if (!roomId) return;
      const trimmed = requesterName?.trim();
      const payload: Omit<QueueItem, 'queueId'> = {
        id: item.id,
        title: item.title,
        channel: item.channel,
        thumbnail: item.thumbnail,
        duration: item.duration,
      };
      // Firebase rejects `undefined`; only include the field when there's a
      // real name. Empty strings are treated as "no requester" too.
      if (trimmed) payload.requesterName = trimmed;
      const newRef = push(ref(db, `${getRoomDataPath(roomId)}/queue`), payload);
      const newQueueId = newRef.key;
      // Only spend an API call when the host actually wants an MC. Host
      // can flip the toggle on later, but those earlier songs will fall
      // through to the TV's live-fetch path — that's acceptable.
      if (newQueueId && roomDataRef.current.isMCEnabled) {
        generateMCForQueueItem(
          roomId,
          newQueueId,
          item.id,
          item.title,
          trimmed ?? null,
        );
      }
    },
    [roomId, roomDataRef, generateMCForQueueItem],
  );

  const updateRequesterName = useCallback(
    (queueId: string, newName: string | null) => {
      if (!roomId) return;
      const trimmed = newName?.trim();
      // Writing `null` removes the field — keeps the database clean instead
      // of leaving an empty string lingering.
      set(ref(db, `${getRoomDataPath(roomId)}/queue/${queueId}/requesterName`), trimmed || null);
      // Singer changed → previously-cached MC line is stale; regenerate so
      // the new singer is referenced when the song plays.
      if (roomDataRef.current.isMCEnabled) {
        const item = roomDataRef.current.queue.find((q) => q.queueId === queueId);
        if (item) {
          generateMCForQueueItem(
            roomId,
            queueId,
            item.id,
            item.title,
            trimmed || null,
          );
        }
      }
    },
    [roomId, roomDataRef, generateMCForQueueItem],
  );

  const removeSong = useCallback(
    (songId: string) => {
      if (!roomId) return;
      remove(ref(db, `${getRoomDataPath(roomId)}/queue/${songId}`));
    },
    [roomId],
  );

  const reorderQueue = useCallback(
    async (startIndex: number, endIndex: number) => {
      if (!roomId) return;
      const { queue } = roomDataRef.current;
      const reordered = [...queue];
      const [moved] = reordered.splice(startIndex, 1);
      reordered.splice(endIndex, 0, moved);
      const queueObject: Record<number, Omit<QueueItem, 'queueId'>> = {};
      reordered.forEach((item, i) => {
        // Drop the local queueId — Firebase keys the wire shape by index,
        // not by the original push() id.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { queueId: _q, ...rest } = item;
        queueObject[i] = rest;
      });
      await set(ref(db, `${getRoomDataPath(roomId)}/queue`), queueObject);
    },
    [roomId, roomDataRef],
  );

  const togglePlayPause = useCallback(
    (currentStatus: boolean) => {
      if (!roomId) return;
      set(ref(db, `${getRoomDataPath(roomId)}/isPlaying`), !currentStatus);
    },
    [roomId],
  );

  // Direct setter so the player can sync iframe-originated state changes
  // (e.g. user clicks the video on the TV) back to the room.
  const setIsPlaying = useCallback(
    (playing: boolean) => {
      if (!roomId) return;
      set(ref(db, `${getRoomDataPath(roomId)}/isPlaying`), playing);
    },
    [roomId],
  );

  // Advances playback. With items in the queue: promotes queue[0] to
  // currentPlaying. With an empty queue: clears currentPlaying after pushing
  // it to history — this frees the "now playing" slot so auto-random (or the
  // user) can fill it next, instead of leaving the just-finished song stuck.
  const playNext = useCallback(async () => {
    if (!roomId) return;
    const { queue, currentPlaying, history } = roomDataRef.current;

    if (queue.length === 0) {
      if (!currentPlaying) return;
      const newHistory = [...history, currentPlaying];
      const histObj = arrayToRecord(newHistory);
      await set(ref(db, `${getRoomDataPath(roomId)}/history`), histObj);
      await remove(ref(db, `${getRoomDataPath(roomId)}/currentPlaying`));
      return;
    }

    const next = queue[0];
    if (currentPlaying) {
      const newHistory = [...history, currentPlaying];
      const histObj = arrayToRecord(newHistory);
      await set(ref(db, `${getRoomDataPath(roomId)}/history`), histObj);
    }

    const nextPayload: YouTubeVideo = {
      id: next.id,
      title: next.title,
      channel: next.channel,
      thumbnail: next.thumbnail,
      duration: next.duration,
    };
    if (next.requesterName) nextPayload.requesterName = next.requesterName;
    // Carry the pre-generated MC line forward so the TV doesn't have to
    // re-fetch when it picks up the new currentPlaying.
    if (next.mcText) nextPayload.mcText = next.mcText;
    await set(ref(db, `${getRoomDataPath(roomId)}/currentPlaying`), nextPayload);
    await remove(ref(db, `${getRoomDataPath(roomId)}/queue/${next.queueId}`));
  }, [roomId, roomDataRef]);

  // Used by auto-random to bypass the queue entirely: writes the picked
  // video straight to currentPlaying. Only safe to call when the slot is
  // already empty (i.e. nothing is playing) — the caller is responsible
  // for that check.
  const setCurrentPlayingDirectly = useCallback(
    async (item: YouTubeVideo) => {
      if (!roomId) return;
      await set(ref(db, `${getRoomDataPath(roomId)}/currentPlaying`), {
        id: item.id,
        title: item.title,
        channel: item.channel,
        thumbnail: item.thumbnail,
        duration: item.duration,
      });
    },
    [roomId],
  );

  // Removes the currently-playing song without skipping to the next via
  // queue. Pushes it onto history (so playPrevious can restore it) and
  // clears currentPlaying. The TV's auto-promote effect will pick up the
  // next queued song; if the queue is empty and auto-random is on, the
  // idle effect will fetch a new one.
  const removeCurrentPlaying = useCallback(async () => {
    if (!roomId) return;
    const { currentPlaying, history } = roomDataRef.current;
    if (!currentPlaying) return;

    const newHistory = [...history, currentPlaying];
    const histObj = arrayToRecord(newHistory);
    await set(ref(db, `${getRoomDataPath(roomId)}/history`), histObj);
    await remove(ref(db, `${getRoomDataPath(roomId)}/currentPlaying`));
  }, [roomId, roomDataRef]);

  // Restores the previous song from history, pushing currentPlaying back to queue front.
  const playPrevious = useCallback(async () => {
    if (!roomId) return;
    const { queue, currentPlaying, history } = roomDataRef.current;
    if (history.length === 0) return;

    const prev = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    const newQueue: YouTubeVideo[] = currentPlaying
      ? [currentPlaying, ...queue]
      : [...queue];

    const queueObj: Record<number, Omit<YouTubeVideo, never>> = {};
    newQueue.forEach((item, i) => {
      // Drop queueId for the Firebase wire shape (see reorderQueue).
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { queueId: _q, ...rest } = item as QueueItem;
      queueObj[i] = rest;
    });

    const histObj = arrayToRecord(newHistory);

    await set(ref(db, `${getRoomDataPath(roomId)}/currentPlaying`), prev);

    if (newQueue.length > 0) {
      await set(ref(db, `${getRoomDataPath(roomId)}/queue`), queueObj);
    } else {
      await remove(ref(db, `${getRoomDataPath(roomId)}/queue`));
    }

    if (newHistory.length > 0) {
      await set(ref(db, `${getRoomDataPath(roomId)}/history`), histObj);
    } else {
      await remove(ref(db, `${getRoomDataPath(roomId)}/history`));
    }
  }, [roomId, roomDataRef]);

  return {
    addSongToQueue,
    updateRequesterName,
    removeSong,
    reorderQueue,
    togglePlayPause,
    setIsPlaying,
    playNext,
    playPrevious,
    setCurrentPlayingDirectly,
    removeCurrentPlaying,
  };
}
