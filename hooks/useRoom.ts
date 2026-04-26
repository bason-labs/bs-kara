'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ref, onValue, push, remove, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { QueueItem, YouTubeVideo } from '@/lib/youtube';

export interface RoomState {
  queue: QueueItem[];
  currentPlaying: YouTubeVideo | null;
}

const DEFAULT_STATE: RoomState = { queue: [], currentPlaying: null };

export function useRoom(roomId: string | null) {
  const [roomData, setRoomData] = useState<RoomState>(DEFAULT_STATE);
  // Ref so write functions always see fresh queue without stale closure issues
  const roomDataRef = useRef(roomData);
  roomDataRef.current = roomData;

  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsub = onValue(roomRef, (snapshot) => {
      const data = snapshot.val() as {
        queue?: Record<string, Omit<QueueItem, 'queueId'>>;
        currentPlaying?: YouTubeVideo;
      } | null;

      if (!data) {
        setRoomData(DEFAULT_STATE);
        return;
      }

      // Firebase stores push-list as an object keyed by push ID; convert to array
      const queue: QueueItem[] = data.queue
        ? Object.entries(data.queue).map(([key, item]) => ({ ...item, queueId: key }))
        : [];

      setRoomData({ queue, currentPlaying: data.currentPlaying ?? null });
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

  // Promotes the first queued song to currentPlaying and removes it from the queue
  const playNext = useCallback(async () => {
    if (!roomId) return;
    const { queue } = roomDataRef.current;
    if (queue.length === 0) return;
    const next = queue[0];
    await set(ref(db, `rooms/${roomId}/currentPlaying`), {
      id: next.id,
      title: next.title,
      channel: next.channel,
      thumbnail: next.thumbnail,
      duration: next.duration,
    });
    await remove(ref(db, `rooms/${roomId}/queue/${next.queueId}`));
  }, [roomId]);

  return { roomData, addSongToQueue, removeSong, playNext };
}
