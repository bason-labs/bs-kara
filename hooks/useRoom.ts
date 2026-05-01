'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ref,
  onValue,
  push,
  remove,
  runTransaction,
  set,
  update,
} from 'firebase/database';
import { db } from '@/lib/firebase';
import {
  DEFAULT_RANDOM_FILTERS,
  QueueItem,
  RandomFilters,
  YouTubeVideo,
} from '@/lib/youtube';

export interface RoomState {
  queue: QueueItem[];
  currentPlaying: YouTubeVideo | null;
  isPlaying: boolean;
  volume: number;
  history: YouTubeVideo[];
  isAutoRandomMode: boolean;
  randomFilters: RandomFilters;
  playedHistory: string[];
  dragDropEnabled: boolean;
  requesterPromptEnabled: boolean;
  isMCEnabled: boolean;
  // Google TTS voice id (from the Settings dropdown). Read by useMCPlayer
  // and forwarded to /api/tts. Falls back to the default if missing.
  mcVoice: string;
  // Cross-device announcement lock — devices race to write
  // currentPlaying.id here. The winner announces; losers see this already
  // matches and skip the MC. Persists across reconnects so a refresh of
  // the announcing device doesn't double up.
  lastAnnouncedSongId: string | null;
  // Set by the TV via Firebase onDisconnect presence; mobile uses this to
  // hide its now-playing card (the TV is already showing it).
  isTvActive: boolean;
}

const DEFAULT_STATE: RoomState = {
  queue: [],
  currentPlaying: null,
  isPlaying: true,
  volume: 100,
  history: [],
  isAutoRandomMode: false,
  randomFilters: DEFAULT_RANDOM_FILTERS,
  playedHistory: [],
  dragDropEnabled: true,
  requesterPromptEnabled: true,
  isMCEnabled: true,
  mcVoice: 'vi-VN-Neural2-A',
  lastAnnouncedSongId: null,
  isTvActive: false,
};

export function useRoom(roomId: string | null) {
  const [roomData, setRoomData] = useState<RoomState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(false);
  // null while we haven't heard back from Firebase yet, true/false after the
  // first snapshot. Lets the UI distinguish "still loading" from "missing".
  const [roomExists, setRoomExists] = useState<boolean | null>(null);
  // Ref so write functions always see fresh state without stale closure issues
  const roomDataRef = useRef(roomData);
  roomDataRef.current = roomData;

  useEffect(() => {
    if (!roomId) {
      setRoomData(DEFAULT_STATE);
      setIsLoading(false);
      setRoomExists(null);
      return;
    }

    // Instantly clear stale data and show loading state when room changes
    setRoomData(DEFAULT_STATE);
    setIsLoading(true);
    setRoomExists(null);

    const roomRef = ref(db, `rooms/${roomId}`);
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
        isTvActive?: boolean;
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
        isTvActive: data.isTvActive === true,
      });
      setIsLoading(false);
    });
    return unsub;
  }, [roomId]);

  // Fire-and-forget: ask the BFF for an MC line and write it onto whichever
  // node holds the song by the time the response arrives. The LLM call
  // typically takes 1–3s; in that window the song often gets promoted from
  // `queue/${queueId}` to `currentPlaying` (especially when it was added to
  // an empty queue with nothing playing — the auto-promote effect fires
  // immediately). We try the queue path first; if the node is already gone,
  // we fall through to currentPlaying matched by videoId so the announcer
  // still gets the AI line instead of the static fallback.
  const generateMCForQueueItem = useCallback(
    async (
      currentRoomId: string,
      queueId: string,
      videoId: string,
      title: string,
      requesterName: string | null,
    ) => {
      try {
        const res = await fetch('/api/generate-mc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songTitle: title, singerName: requesterName }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { text?: unknown };
        const text =
          typeof data.text === 'string' && data.text.trim()
            ? data.text.trim()
            : null;
        if (!text) return;
        // Use a transaction (not `set`) so a deleted node can't be
        // resurrected with only { mcText } — that would leave a zombie
        // entry with no id/title/thumbnail.
        const queueResult = await runTransaction(
          ref(db, `rooms/${currentRoomId}/queue/${queueId}`),
          (current) => {
            if (current === null) return undefined; // node deleted — abort
            return { ...current, mcText: text };
          },
        );
        // Queue write committed → song was still queued → done.
        if (queueResult.committed && queueResult.snapshot.exists()) return;
        // Otherwise the song likely already promoted; write to
        // currentPlaying iff its id still matches (avoids clobbering the
        // line with a stale write after the next song has started).
        await runTransaction(
          ref(db, `rooms/${currentRoomId}/currentPlaying`),
          (current) => {
            if (!current || current.id !== videoId) return undefined;
            return { ...current, mcText: text };
          },
        );
      } catch {
        // Pre-generation is opportunistic — failures are absorbed and the
        // announcer falls through to the static fallback line.
      }
    },
    [],
  );

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
      const newRef = push(ref(db, `rooms/${roomId}/queue`), payload);
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
    [roomId, generateMCForQueueItem],
  );

  const updateRequesterName = useCallback(
    (queueId: string, newName: string | null) => {
      if (!roomId) return;
      const trimmed = newName?.trim();
      // Writing `null` removes the field — keeps the database clean instead
      // of leaving an empty string lingering.
      set(ref(db, `rooms/${roomId}/queue/${queueId}/requesterName`), trimmed || null);
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
    [roomId, generateMCForQueueItem],
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
      const histObj: Record<number, YouTubeVideo> = {};
      newHistory.forEach((item, i) => { histObj[i] = item; });
      await set(ref(db, `rooms/${roomId}/history`), histObj);
      await remove(ref(db, `rooms/${roomId}/currentPlaying`));
      return;
    }

    const next = queue[0];
    if (currentPlaying) {
      const newHistory = [...history, currentPlaying];
      const histObj: Record<number, YouTubeVideo> = {};
      newHistory.forEach((item, i) => { histObj[i] = item; });
      await set(ref(db, `rooms/${roomId}/history`), histObj);
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
    await set(ref(db, `rooms/${roomId}/currentPlaying`), nextPayload);
    await remove(ref(db, `rooms/${roomId}/queue/${next.queueId}`));
  }, [roomId]);

  // Used by auto-random to bypass the queue entirely: writes the picked
  // video straight to currentPlaying. Only safe to call when the slot is
  // already empty (i.e. nothing is playing) — the caller is responsible
  // for that check.
  const setCurrentPlayingDirectly = useCallback(
    async (item: YouTubeVideo) => {
      if (!roomId) return;
      await set(ref(db, `rooms/${roomId}/currentPlaying`), {
        id: item.id,
        title: item.title,
        channel: item.channel,
        thumbnail: item.thumbnail,
        duration: item.duration,
      });
    },
    [roomId],
  );

  const clearRoom = useCallback(async () => {
    if (!roomId) return;
    await remove(ref(db, `rooms/${roomId}`));
  }, [roomId]);

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
    const histObj: Record<number, YouTubeVideo> = {};
    newHistory.forEach((item, i) => { histObj[i] = item; });
    await set(ref(db, `rooms/${roomId}/history`), histObj);
    await remove(ref(db, `rooms/${roomId}/currentPlaying`));
  }, [roomId]);

  const setAutoRandomMode = useCallback(
    (enabled: boolean) => {
      if (!roomId) return;
      set(ref(db, `rooms/${roomId}/isAutoRandomMode`), enabled);
    },
    [roomId],
  );

  const setRandomFilters = useCallback(
    (filters: Partial<RandomFilters>) => {
      if (!roomId) return;
      const current = roomDataRef.current.randomFilters;
      update(ref(db, `rooms/${roomId}/randomFilters`), {
        type: filters.type ?? current.type,
        tone: filters.tone ?? current.tone,
        genre: filters.genre ?? current.genre,
      });
    },
    [roomId],
  );

  const setDragDropEnabled = useCallback(
    (enabled: boolean) => {
      if (!roomId) return;
      set(ref(db, `rooms/${roomId}/dragDropEnabled`), enabled);
    },
    [roomId],
  );

  const setRequesterPromptEnabled = useCallback(
    (enabled: boolean) => {
      if (!roomId) return;
      set(ref(db, `rooms/${roomId}/requesterPromptEnabled`), enabled);
    },
    [roomId],
  );

  const setMCEnabled = useCallback(
    (enabled: boolean) => {
      if (!roomId) return;
      set(ref(db, `rooms/${roomId}/isMCEnabled`), enabled);
    },
    [roomId],
  );

  const setMcVoice = useCallback(
    (voice: string) => {
      if (!roomId) return;
      if (!voice) return;
      set(ref(db, `rooms/${roomId}/mcVoice`), voice);
    },
    [roomId],
  );

  // Atomic claim: returns true iff this caller wins the race for `songId`.
  // Losers (committed === false because the value already matched) skip
  // the announcement and start the video immediately.
  const tryClaimAnnouncementLock = useCallback(
    async (songId: string): Promise<boolean> => {
      if (!roomId) return false;
      const result = await runTransaction(
        ref(db, `rooms/${roomId}/lastAnnouncedSongId`),
        (current) => {
          if (current === songId) return undefined; // already claimed → abort
          return songId;
        },
      );
      return result.committed;
    },
    [roomId],
  );

  // Append a YouTube videoId to playedHistory so the auto-random picker can
  // skip songs we've already pulled in this session.
  const addToPlayedHistory = useCallback(
    async (videoId: string) => {
      if (!roomId) return;
      const existing = roomDataRef.current.playedHistory;
      if (existing.includes(videoId)) return;
      const next = [...existing, videoId];
      const obj: Record<number, string> = {};
      next.forEach((v, i) => { obj[i] = v; });
      await set(ref(db, `rooms/${roomId}/playedHistory`), obj);
    },
    [roomId],
  );

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
    roomExists,
    addSongToQueue,
    updateRequesterName,
    removeSong,
    reorderQueue,
    togglePlayPause,
    setIsPlaying,
    setVolume,
    playNext,
    playPrevious,
    sendEmoji,
    clearRoom,
    setAutoRandomMode,
    setRandomFilters,
    addToPlayedHistory,
    setDragDropEnabled,
    setRequesterPromptEnabled,
    setMCEnabled,
    setMcVoice,
    tryClaimAnnouncementLock,
    removeCurrentPlaying,
    setCurrentPlayingDirectly,
  };
}
