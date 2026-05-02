'use client';

import {
  type ComponentType,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { ListMusic, Trash2 } from 'lucide-react';
import { QueueItem } from '@/lib/youtube/types';
import { QueueItemBody } from './QueueItemBody';
import type { DndQueueListProps } from './DndQueueList';

// Flips to true on the first client render (post-hydration), so we don't
// SSR @hello-pangea/dnd which hates it.
const subscribeNoop = () => () => {};
const getClientMounted = () => true;
const getServerMounted = () => false;

interface ClientQueueProps {
  items: QueueItem[];
  isLoading?: boolean;
  onReorder: (startIndex: number, endIndex: number) => void;
  onRemove: (queueId: string) => void;
  // Opens the requester dialog scoped to this queue item. Optional — when
  // omitted, the edit affordance is hidden (e.g. for a future read-only
  // viewer).
  onEditRequester?: (item: QueueItem) => void;
  // Room-wide setting. When false we render the static list (same path used
  // during SSR/pre-hydration), so songs can still be removed but not dragged.
  dragDropEnabled?: boolean;
}

export function ClientQueue({
  items,
  isLoading,
  onReorder,
  onRemove,
  onEditRequester,
  dragDropEnabled = true,
}: ClientQueueProps) {
  const { t } = useTranslation();
  const mounted = useSyncExternalStore(subscribeNoop, getClientMounted, getServerMounted);
  const dndActive = mounted && dragDropEnabled;

  // Lazy-load the DnD subtree (~165 KB minified for @hello-pangea/dnd) only
  // after dndActive becomes true. The static list below renders the queue
  // immediately on first paint; once the chunk arrives we swap to the DnD
  // version and the drag handles light up. Subsequent visits hit the
  // browser's chunk cache so the swap is effectively synchronous.
  const [DndComp, setDndComp] = useState<ComponentType<DndQueueListProps> | null>(null);
  useEffect(() => {
    if (!dndActive || DndComp) return;
    let cancelled = false;
    import('./DndQueueList').then((m) => {
      if (!cancelled) setDndComp(() => m.DndQueueList);
    });
    return () => {
      cancelled = true;
    };
  }, [dndActive, DndComp]);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 px-4 py-3 bg-bg/85 backdrop-blur-sm border-b border-border">
        <h2 className="text-sm font-semibold text-fg">
          {t('queue.title')}{' '}
          {!isLoading && items.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted">({items.length})</span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-2.5 mt-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border animate-pulse"
              >
                <div className="w-5 h-4 bg-surface-2 rounded shrink-0" />
                <div className="w-20 h-12 bg-surface-2 rounded-md shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-surface-2 rounded w-full" />
                  <div className="h-3 bg-surface-2 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <ListMusic size={56} className="mb-3 text-muted opacity-60" />
                <p className="text-muted text-xs">{t('queue.emptyMessage')}</p>
              </div>
            )}

            {dndActive && DndComp ? (
              <DndComp
                items={items}
                onReorder={onReorder}
                onRemove={onRemove}
                onEditRequester={onEditRequester}
              />
            ) : (
              <div className="space-y-2.5">
                {items.map((item, index) => (
                  <div
                    key={item.queueId}
                    className="flex items-center gap-3 p-3 lg:gap-2.5 lg:p-2.5 bg-surface rounded-xl border border-border"
                  >
                    <span className="tabular shrink-0 w-5 lg:w-4 text-xs lg:text-[11px] font-semibold text-muted text-center">
                      {index + 1}
                    </span>

                    <div className="relative w-24 h-14 lg:w-24 lg:h-14 shrink-0 rounded-lg overflow-hidden bg-black/40">
                      <Image
                        src={item.thumbnail}
                        alt={item.title}
                        fill
                        className="object-contain object-center"
                        unoptimized
                      />
                    </div>

                    <QueueItemBody
                      item={item}
                      onEditRequester={onEditRequester}
                    />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item.queueId);
                      }}
                      aria-label={t('queue.removeAriaLabel')}
                      className="shrink-0 p-2 lg:p-1.5 rounded-md text-muted hover:text-danger hover:bg-surface-2 transition-colors"
                    >
                      <Trash2 className="w-[18px] h-[18px] lg:w-[15px] lg:h-[15px]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
