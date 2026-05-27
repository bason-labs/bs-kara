import { useCallback, type RefObject } from 'react';
import { ref, push, remove, set, runTransaction, update } from 'firebase/database';
import { db } from '../../lib/firebase';
import { getRoomDataPath } from '../../lib/roomPaths';
import type { QueueItem, YouTubeVideo } from '../../lib/youtube/types';
import { arrayToRecord, type GenerateMCForQueueItem, type RoomState } from './types';

// All queue / now-playing mutations. Reads fresh state via roomDataRef so
// rapid callers don't race a stale closure.
export function useRoomQueue(
  roomId: string | null,
  roomDataRef: RefObject<RoomState>,
  generateMCForQueueItem: GenerateMCForQueueItem,
) {
  const addSongToQueue = useCallback(
    async (item: YouTubeVideo, requesterName?: string | null) => {
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

      // When nothing is currently playing, claim /currentPlaying atomically
      // and skip the queue entirely. Without this, the song flashed in the
      // queue list for one snapshot before the auto-promote effect moved it
      // to currentPlaying — visually jumpy. The transaction handles the
      // race where two devices add at the same idle moment: the loser
      // (committed === false because Firebase saw a non-null value
      // mid-flight) falls through to the queue path below.
      if (!roomDataRef.current.currentPlaying) {
        const result = await runTransaction(
          ref(db, `${getRoomDataPath(roomId)}/currentPlaying`),
          (current) => (current ? undefined : payload),
        );
        if (result.committed) {
          if (roomDataRef.current.isMCEnabled) {
            // No queueId for the direct path. Pass the videoId as a synthetic
            // key — generateMCForQueueItem's queue transaction will see
            // `current === null`, abort, and fall through to the
            // currentPlaying path keyed by videoId, which is exactly what we
            // want here.
            generateMCForQueueItem(roomId, item.id, item.id, item.title, trimmed ?? null);
          }
          // Promoting into an empty currentPlaying slot implies playback
          // intent. isPlaying may have been left false by the prior song's
          // ENDED iframe ping or an earlier explicit pause; flip it back so
          // the new song actually plays instead of mounting paused.
          await set(ref(db, `${getRoomDataPath(roomId)}/isPlaying`), true);
          return;
        }
      }

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
    // Promoting from the queue implies playback intent. The previous song's
    // ENDED iframe ping (or an explicit pause) may have left isPlaying=false;
    // flip it back so the new song actually plays after the MC gate releases.
    await set(ref(db, `${getRoomDataPath(roomId)}/isPlaying`), true);
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
      // Auto-random is the user's "keep the room playing forever" toggle —
      // promoting a picked song must also flip isPlaying back on, since the
      // prior song's ENDED ping likely left it false.
      await set(ref(db, `${getRoomDataPath(roomId)}/isPlaying`), true);
    },
    [roomId],
  );

  // "Play Now": promotes `video` to currentPlaying immediately. The
  // previous track (if any) is sent to history — NOT prepended back to
  // the queue — so this behaves like Skip + Replace: the displaced song
  // is reachable via the Previous button (mirrors removeCurrentPlaying's
  // pattern), but the queue order is untouched. When sourced from a queue
  // item, only that one queueId is removed from /queue; the rest stays
  // as-is. Everything lands in one multi-path update() so no observer
  // sees the picked song in both /currentPlaying and /queue at once.
  const playSongNow = useCallback(
    async (video: YouTubeVideo, sourceQueueId?: string) => {
      if (!roomId) return;
      const { currentPlaying, history } = roomDataRef.current;

      // Already playing — nothing to do (button is also hidden in this
      // case; this guard handles the rare race where the snapshot updates
      // between the row render and the confirm tap).
      if (currentPlaying && currentPlaying.id === video.id) return;

      const nextPayload: YouTubeVideo = {
        id: video.id,
        title: video.title,
        channel: video.channel,
        thumbnail: video.thumbnail,
        duration: video.duration,
      };
      if (video.requesterName) nextPayload.requesterName = video.requesterName;
      if (video.mcText) nextPayload.mcText = video.mcText;

      const updates: Record<string, unknown> = {
        currentPlaying: nextPayload,
        isPlaying: true,
      };
      // Skip-and-replace: same pattern as removeCurrentPlaying — the
      // displaced song lands at the tail of /history so playPrevious can
      // restore it. The full /history array is rewritten via
      // arrayToRecord (Firebase's index-keyed wire shape).
      if (currentPlaying) {
        updates.history = arrayToRecord([...history, currentPlaying]);
      }
      // Source is a queue row → remove just that one entry as part of
      // the same atomic write. Nothing else in /queue is touched.
      if (sourceQueueId) {
        updates[`queue/${sourceQueueId}`] = null;
      }
      await update(ref(db, getRoomDataPath(roomId)), updates);
    },
    [roomId, roomDataRef],
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
    // Restoring a previous song is a playback-intent action; mirror the
    // playNext promote path so the restored song doesn't mount paused if
    // isPlaying was left false by the prior song's ENDED ping.
    await set(ref(db, `${getRoomDataPath(roomId)}/isPlaying`), true);

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
    playSongNow,
  };
}
