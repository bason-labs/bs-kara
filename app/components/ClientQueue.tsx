'use client';

import { useSyncExternalStore } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, ListMusic, Trash2 } from 'lucide-react';
import { QueueItem } from '@/lib/youtube';

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
}

export function ClientQueue({ items, isLoading, onReorder, onRemove }: ClientQueueProps) {
  const { t } = useTranslation();
  const mounted = useSyncExternalStore(subscribeNoop, getClientMounted, getServerMounted);

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    onReorder(result.source.index, result.destination.index);
  }

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

            {mounted ? (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="queue">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2.5"
                    >
                      {items.map((item, index) => (
                        <Draggable key={item.queueId} draggableId={item.queueId} index={index}>
                          {(drag, snapshot) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                snapshot.isDragging
                                  ? 'bg-surface-2 border-glow shadow-glow'
                                  : 'bg-surface border-border hover:border-glow/40 hover:bg-surface-2/60'
                              }`}
                            >
                              <div
                                {...drag.dragHandleProps}
                                aria-label="Drag to reorder"
                                className="shrink-0 -ml-1 p-1 rounded-md text-muted hover:text-fg cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical size={16} />
                              </div>

                              <span className="tabular shrink-0 w-5 text-xs font-semibold text-muted text-center">
                                {index + 1}
                              </span>

                              <div className="relative w-20 h-12 shrink-0 rounded-md overflow-hidden bg-surface-2">
                                <Image
                                  src={item.thumbnail}
                                  alt={item.title}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-fg line-clamp-2 leading-snug">
                                  {item.title}
                                </p>
                                <p className="text-xs text-muted truncate mt-0.5">
                                  {item.channel}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemove(item.queueId);
                                }}
                                aria-label={t('queue.removeAriaLabel')}
                                className="shrink-0 p-1.5 rounded-md text-muted hover:text-danger hover:bg-surface transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <div className="space-y-2.5">
                {items.map((item, index) => (
                  <div
                    key={item.queueId}
                    className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border"
                  >
                    <span className="tabular shrink-0 w-5 text-xs font-semibold text-muted text-center">
                      {index + 1}
                    </span>

                    <div className="relative w-20 h-12 shrink-0 rounded-md overflow-hidden bg-surface-2">
                      <Image
                        src={item.thumbnail}
                        alt={item.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg line-clamp-2 leading-snug">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted truncate mt-0.5">{item.channel}</p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item.queueId);
                      }}
                      aria-label={t('queue.removeAriaLabel')}
                      className="shrink-0 p-1.5 rounded-md text-muted hover:text-danger hover:bg-surface-2 transition-colors"
                    >
                      <Trash2 size={16} />
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
