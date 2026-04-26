'use client';

import Image from 'next/image';
import { QueueItem } from '@/lib/youtube';

interface ClientQueueProps {
  items: QueueItem[];
}

export function ClientQueue({ items }: ClientQueueProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">
          Queue{' '}
          {items.length > 0 && (
            <span className="ml-1 text-xs font-normal text-gray-400">
              ({items.length})
            </span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">Queue is empty</p>
        )}

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
    </div>
  );
}
