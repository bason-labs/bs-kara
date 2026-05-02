'use client';

import { useMemo } from 'react';
import type { QueueItem } from '@/lib/youtube/types';

// videoId → queueId for songs currently waiting in the queue. Used by
// SearchPanel to toggle the "+ Add" / "Added" button into a remove action.
// currentPlaying is intentionally not folded in — you can't "un-add" the
// song that's already playing.
export function useQueuedMap(queue: QueueItem[]): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const q of queue) {
      if (!map.has(q.id)) map.set(q.id, q.queueId);
    }
    return map;
  }, [queue]);
}
