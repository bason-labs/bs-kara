'use client';

import { useCallback } from 'react';
import { ref, runTransaction } from 'firebase/database';
import { db } from '@/lib/firebase';
import { getRoomDataPath } from '@/lib/roomPaths';
import type { GenerateMCForQueueItem } from './types';

// Returns the internal generator (consumed by queue mutations) plus the
// public-facing MC primitives that callers of useRoom see directly.
export function useRoomMC(roomId: string | null) {
  // Fire-and-forget: ask the BFF for an MC line and write it onto whichever
  // node holds the song by the time the response arrives. The LLM call
  // typically takes 1–3s; in that window the song often gets promoted from
  // `queue/${queueId}` to `currentPlaying` (especially when it was added to
  // an empty queue with nothing playing — the auto-promote effect fires
  // immediately). We try the queue path first; if the node is already gone,
  // we fall through to currentPlaying matched by videoId so the announcer
  // still gets the AI line instead of the static fallback.
  const generateMCForQueueItem = useCallback<GenerateMCForQueueItem>(
    async (currentRoomId, queueId, videoId, title, requesterName) => {
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
          ref(db, `${getRoomDataPath(currentRoomId)}/queue/${queueId}`),
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
          ref(db, `${getRoomDataPath(currentRoomId)}/currentPlaying`),
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

  // Atomic claim: returns true iff this caller wins the race for `songId`.
  // Losers (committed === false because the value already matched) skip
  // the announcement and start the video immediately.
  const tryClaimAnnouncementLock = useCallback(
    async (songId: string): Promise<boolean> => {
      if (!roomId) return false;
      const result = await runTransaction(
        ref(db, `${getRoomDataPath(roomId)}/lastAnnouncedSongId`),
        (current) => {
          if (current === songId) return undefined; // already claimed → abort
          return songId;
        },
      );
      return result.committed;
    },
    [roomId],
  );

  return { generateMCForQueueItem, tryClaimAnnouncementLock };
}
