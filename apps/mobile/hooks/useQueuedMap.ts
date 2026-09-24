import { useMemo } from 'react';
import type { QueueItem } from '@bs-kara/shared';

export function useQueuedMap(queue: QueueItem[]): Map<string, string> {
  return useMemo(
    () => new Map(queue.map((item) => [item.id, item.queueId])),
    [queue]
  );
}
