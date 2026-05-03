'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import { GripVertical, Trash2 } from 'lucide-react';
import type { QueueItem } from '@/lib/youtube/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { QueueItemBody } from './QueueItemBody';

export interface DndQueueListProps {
  items: QueueItem[];
  onReorder: (startIndex: number, endIndex: number) => void;
  onRemove: (queueId: string) => void;
  onEditRequester?: (item: QueueItem) => void;
}

// The drag-and-drop branch lives in its own file so @hello-pangea/dnd
// (~165 KB minified) can be split into a separately-loaded chunk via
// dynamic import. Markup must remain byte-identical to the previous
// inline subtree in ClientQueue: classes, aria labels, refs, and the
// surrounding flex spacing are all load-bearing for visual + a11y parity.
export function DndQueueList({
  items,
  onReorder,
  onRemove,
  onEditRequester,
}: DndQueueListProps) {
  const { t } = useTranslation();
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    onReorder(result.source.index, result.destination.index);
  }

  return (
    <>
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
                        setPendingRemoveId(item.queueId);
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
    <ConfirmDialog
      open={pendingRemoveId !== null}
      title={t('queue.removeConfirm.title')}
      message={t('queue.removeConfirm.message')}
      confirmLabel={t('queue.removeConfirm.confirm')}
      cancelLabel={t('queue.removeConfirm.cancel')}
      onConfirm={() => {
        if (pendingRemoveId !== null) onRemove(pendingRemoveId);
        setPendingRemoveId(null);
      }}
      onCancel={() => setPendingRemoveId(null)}
    />
    </>
  );
}
