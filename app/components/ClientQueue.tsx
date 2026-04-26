'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import { QueueItem } from '@/lib/youtube';

interface ClientQueueProps {
  items: QueueItem[];
  isLoading?: boolean;
  onReorder: (startIndex: number, endIndex: number) => void;
}

export function ClientQueue({ items, isLoading, onReorder }: ClientQueueProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    onReorder(result.source.index, result.destination.index);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">
          Queue{' '}
          {!isLoading && items.length > 0 && (
            <span className="ml-1 text-xs font-normal text-gray-400">
              ({items.length})
            </span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-2 mt-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-2 p-2 bg-white rounded-lg border border-gray-100 shadow-sm animate-pulse">
                <div className="w-5 h-4 bg-gray-200 rounded shrink-0 mt-0.5" />
                <div className="w-16 h-9 bg-gray-200 rounded shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {items.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-8">Queue is empty</p>
            )}

        {mounted ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="queue">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-2"
                >
                  {items.map((item, index) => (
                    <Draggable key={item.queueId} draggableId={item.queueId} index={index}>
                      {(drag) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          className="flex gap-2 p-2 bg-white rounded-lg border border-gray-100 shadow-sm"
                        >
                          <div
                            {...drag.dragHandleProps}
                            className="flex-shrink-0 flex items-center text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical size={14} />
                          </div>

                          <span className="flex-shrink-0 w-5 text-xs text-gray-400 font-mono pt-0.5 text-center">
                            {index + 1}
                          </span>

                          <div className="relative w-16 h-9 flex-shrink-0 rounded overflow-hidden bg-gray-200">
                            <Image
                              src={item.thumbnail}
                              alt={item.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight">
                              {item.title}
                            </p>
                            <p className="text-xs text-gray-400 truncate mt-0.5">{item.channel}</p>
                          </div>
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
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={item.queueId}
                className="flex gap-2 p-2 bg-white rounded-lg border border-gray-100 shadow-sm"
              >
                <span className="flex-shrink-0 w-5 text-xs text-gray-400 font-mono pt-0.5 text-center">
                  {index + 1}
                </span>

                <div className="relative w-16 h-9 flex-shrink-0 rounded overflow-hidden bg-gray-200">
                  <Image
                    src={item.thumbnail}
                    alt={item.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{item.channel}</p>
                </div>
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
