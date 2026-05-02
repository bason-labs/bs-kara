'use client';

import { useSyncExternalStore } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, ListMusic, Mic, Pencil, Plus, Trash2 } from 'lucide-react';
import { QueueItem } from '@/lib/youtube/types';

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

            {dndActive ? (
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
                              {...drag.dragHandleProps}
                              aria-label="Reorder song"
                              className={`group flex items-center gap-3 p-3 lg:gap-2.5 lg:p-2.5 rounded-xl border transition-colors cursor-grab active:cursor-grabbing ${
                                snapshot.isDragging
                                  ? 'bg-surface-2 border-glow shadow-glow'
                                  : 'bg-surface border-border hover:border-glow/40 hover:bg-surface-2/60'
                              }`}
                            >
                              <div
                                aria-hidden="true"
                                className="shrink-0 -ml-1 text-muted group-hover:text-fg"
                              >
                                <GripVertical className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                              </div>

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
                                className="shrink-0 p-2 lg:p-1.5 rounded-md text-muted hover:text-danger hover:bg-surface transition-colors"
                              >
                                <Trash2 className="w-[18px] h-[18px] lg:w-[15px] lg:h-[15px]" />
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

function QueueItemBody({
  item,
  onEditRequester,
}: {
  item: QueueItem;
  onEditRequester?: (item: QueueItem) => void;
}) {
  const { t } = useTranslation();
  const hasName = !!item.requesterName;
  const editable = !!onEditRequester;

  return (
    <div className="min-w-0 flex-1">
      <p
        title={item.title}
        className="text-[15px] lg:text-sm font-medium text-fg line-clamp-2 leading-snug"
      >
        {item.title}
      </p>
      <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-1.5 mt-1 lg:mt-0.5 min-w-0">
        <p className="hidden lg:block text-[11px] text-muted truncate min-w-0 flex-shrink">
          {item.channel}
        </p>

        {hasName ? (
          <button
            type="button"
            disabled={!editable}
            onClick={(e) => {
              e.stopPropagation();
              if (editable) onEditRequester!(item);
            }}
            aria-label={editable ? t('requester.editAriaLabel') : undefined}
            className={`self-start shrink-0 inline-flex items-center gap-1 max-w-full lg:max-w-[55%] px-2 py-0.5 lg:px-1.5 rounded-full bg-glow/15 text-glow text-xs lg:text-[11px] font-medium transition-colors ${
              editable
                ? 'cursor-pointer hover:bg-glow/25 active:scale-95'
                : 'cursor-default'
            }`}
          >
            <Mic className="shrink-0 w-3 h-3 lg:w-[10px] lg:h-[10px]" />
            <span className="lg:truncate">{item.requesterName}</span>
            {editable && (
              <Pencil className="shrink-0 opacity-70 w-3 h-3 lg:w-[10px] lg:h-[10px]" />
            )}
          </button>
        ) : editable ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditRequester!(item);
            }}
            aria-label={t('requester.addAriaLabel')}
            className="self-start shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 lg:px-1.5 rounded-full border border-dashed border-border text-muted text-xs lg:text-[11px] font-medium hover:text-fg hover:border-glow/50 active:scale-95 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3 lg:w-[10px] lg:h-[10px]" />
            <span>{t('requester.addLabel')}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
