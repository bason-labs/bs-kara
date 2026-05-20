'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ref,
  query,
  orderByChild,
  startAfter,
  onChildAdded,
} from 'firebase/database';
import { db } from '@/lib/firebase';
import { getRoomDataPath } from '@/lib/roomPaths';
import { computeScore, type ScoreResult } from '@/lib/scoring';

interface StoredReaction {
  emoji: string;
  timestamp: number;
}

// Live deterministic score during the outro. Returns null when the toggle
// is off or no song is playing — callers can render unconditionally.
//
// Persistence at onEnd is the responsibility of TVClient / FullscreenPlayer
// (whichever wins tryClaimScoreLock in Batch 4); this hook only drives the
// live display.
export function useSongScore(
  roomId: string | null | undefined,
  currentSongId: string | null | undefined,
  enabled: boolean,
): ScoreResult | null {
  // Reactions live in state (not a ref) so the eslint react-hooks/refs
  // rule stays happy with computeScore being read during render. The
  // visible behavior is identical to the spec's ref + tick pattern.
  const [reactions, setReactions] = useState<StoredReaction[]>([]);

  // Reset reactions on song change, enable toggle, or room change. The
  // effect-level reset mirrors the existing pattern in
  // hooks/useRoom/subscribe.ts where the room snapshot is cleared on
  // roomId switch — same "transition reset on key prop change" shape.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- transition reset on key prop change
    setReactions([]);
  }, [currentSongId, enabled, roomId]);

  // EDGE: on mid-song refresh this device's anchor lands at refresh time and
  // misses earlier reactions on this device only. Persistence at onEnd is
  // serialized via tryClaimScoreLock (Batch 4), so only the lock winner writes.
  // MVP-acceptable. Promote to RoomState.startedAt later if needed.
  useEffect(() => {
    if (!enabled || !currentSongId || !roomId) return;

    const anchor = Date.now();

    const q = query(
      ref(db, `${getRoomDataPath(roomId)}/emojis`),
      orderByChild('timestamp'),
      startAfter(anchor),
    );

    const unsub = onChildAdded(q, (snap) => {
      const data = snap.val() as
        | { emoji?: unknown; timestamp?: unknown }
        | null;
      if (!data || typeof data.emoji !== 'string') return;
      const timestamp =
        typeof data.timestamp === 'number' ? data.timestamp : Date.now();
      const emoji = data.emoji;
      setReactions((prev) => [...prev, { emoji, timestamp }]);
    });
    return unsub;
  }, [enabled, currentSongId, roomId]);

  return useMemo(() => {
    if (!enabled || !currentSongId || !roomId) return null;
    return computeScore({
      reactions: reactions.map((r) => ({ emoji: r.emoji })),
    });
  }, [reactions, enabled, currentSongId, roomId]);
}
