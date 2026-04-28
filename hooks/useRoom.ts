'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ref, onValue, push, remove, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { QueueItem, YouTubeVideo } from '@/lib/youtube';

export interface RoomState {
  queue: QueueItem[];
  currentPlaying: YouTubeVideo | null;
  isPlaying: boolean;
  volume: number;
  history: YouTubeVideo[];
}

const DEFAULT_STATE: RoomState = {
  queue: [],
  currentPlaying: null,
  isPlaying: true,
  volume: 100,
  history: [],
};

export function useRoom(roomId: string | null) {
  const [roomData, setRoomData] = useState<RoomState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(false);
  // Ref so write functions always see fresh state without stale closure issues
  const roomDataRef = useRef(roomData);
  roomDataRef.current = roomData;

  useEffect(() => {
    if (!roomId) {
      setRoomData(DEFAULT_STATE);
      setIsLoading(false);
      return;
    }

    // Instantly clear stale data and show loading state when room changes
    setRoomData(DEFAULT_STATE);
    setIsLoading(true);

    const roomRef = ref(db, `rooms/${roomId}`);
    const unsub = onValue(roomRef, (snapshot) => {
      const data = snapshot.val() as {
        queue?: Record<string, Omit<QueueItem, 'queueId'>>;
        currentPlaying?: YouTubeVideo;
        isPlaying?: boolean;
        volume?: number;
        history?: Record<string, YouTubeVideo>;
      } | null;

      if (!data) {
        setRoomData(DEFAULT_STATE);
        setIsLoading(false);
        return;
      }

      const queue: QueueItem[] = data.queue
        ? Object.entries(data.queue).map(([key, item]) => ({ ...item, queueId: key }))
        : [];

      const history: YouTubeVideo[] = data.history
        ? Object.entries(data.history)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([, item]) => item)
        : [];

      setRoomData({
        queue,
        currentPlaying: data.currentPlaying ?? null,
        isPlaying: data.isPlaying !== undefined ? data.isPlaying : true,
        volume: data.volume !== undefined ? data.volume : 100,
        history,
      });
      setIsLoading(false);
    });
    return unsub;
  }, [roomId]);

  const addSongToQueue = useCallback(
    (item: YouTubeVideo) => {
      if (!roomId) return;
      push(ref(db, `rooms/${roomId}/queue`), {
        id: item.id,
        title: item.title,
        channel: item.channel,
        thumbnail: item.thumbnail,
        duration: item.duration,
      });
    },
    [roomId],
  );

  const removeSong = useCallback(
    (songId: string) => {
      if (!roomId) return;
      remove(ref(db, `rooms/${roomId}/queue/${songId}`));
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
        const { queueId: _q, ...rest } = item;
        queueObject[i] = rest;
      });
      await set(ref(db, `rooms/${roomId}/queue`), queueObject);
    },
    [roomId],
  );

  const togglePlayPause = useCallback(
    (currentStatus: boolean) => {
      if (!roomId) return;
      set(ref(db, `rooms/${roomId}/isPlaying`), !currentStatus);
    },
    [roomId],
  );

  // Direct setter so the player can sync iframe-originated state changes
  // (e.g. user clicks the video on the TV) back to the room.
  const setIsPlaying = useCallback(
    (playing: boolean) => {
      if (!roomId) return;
      set(ref(db, `rooms/${roomId}/isPlaying`), playing);
    },
    [roomId],
  );

  const setVolume = useCallback(
    (vol: number) => {
      if (!roomId) return;
      set(ref(db, `rooms/${roomId}/volume`), Math.max(0, Math.min(100, vol)));
    },
    [roomId],
  );

  // Promotes the first queued song to currentPlaying, removes it from queue,
  // and pushes the old currentPlaying into history.
  const playNext = useCallback(async () => {
    if (!roomId) return;
    const { queue, currentPlaying, history } = roomDataRef.current;
    if (queue.length === 0) return;
    const next = queue[0];

    if (currentPlaying) {
      const newHistory = [...history, currentPlaying];
      const histObj: Record<number, YouTubeVideo> = {};
      newHistory.forEach((item, i) => { histObj[i] = item; });
      await set(ref(db, `rooms/${roomId}/history`), histObj);
    }

    await set(ref(db, `rooms/${roomId}/currentPlaying`), {
      id: next.id,
      title: next.title,
      channel: next.channel,
      thumbnail: next.thumbnail,
      duration: next.duration,
    });
    await remove(ref(db, `rooms/${roomId}/queue/${next.queueId}`));
  }, [roomId]);

  const clearRoom = useCallback(async () => {
    if (!roomId) return;
    await remove(ref(db, `rooms/${roomId}`));
  }, [roomId]);

  const sendEmoji = useCallback(
    (emoji: string) => {
      if (!roomId) return;
      push(ref(db, `rooms/${roomId}/emojis`), { emoji, timestamp: Date.now() });
    },
    [roomId],
  );

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
      const { queueId: _q, ...rest } = item as QueueItem;
      queueObj[i] = rest;
    });

    const histObj: Record<number, YouTubeVideo> = {};
    newHistory.forEach((item, i) => { histObj[i] = item; });

    await set(ref(db, `rooms/${roomId}/currentPlaying`), prev);

    if (newQueue.length > 0) {
      await set(ref(db, `rooms/${roomId}/queue`), queueObj);
    } else {
      await remove(ref(db, `rooms/${roomId}/queue`));
    }

    if (newHistory.length > 0) {
      await set(ref(db, `rooms/${roomId}/history`), histObj);
    } else {
      await remove(ref(db, `rooms/${roomId}/history`));
    }
  }, [roomId]);

  return {
    roomData,
    isLoading,
    addSongToQueue,
    removeSong,
    reorderQueue,
    togglePlayPause,
    setIsPlaying,
    setVolume,
    playNext,
    playPrevious,
    sendEmoji,
    clearRoom,
  };
}
