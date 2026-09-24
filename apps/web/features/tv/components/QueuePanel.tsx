'use client';

import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Mic } from 'lucide-react';
import type { QueueItem } from '@bs-kara/shared';

interface QueuePanelProps {
  queue: QueueItem[];
  isLoading: boolean;
  onEndParty: () => void;
}

// Right-side sidebar on the TV: scrollable queue list (with skeletons /
// empty state) and the End Party trigger at the bottom. Room code + scan-
// to-join QR live on the idle screen now (IdleQRCode), so latecomers see
// them whenever no song is playing instead of crowding the queue rail.
export function QueuePanel({ queue, isLoading, onEndParty }: QueuePanelProps) {
  const { t } = useTranslation();
  return (
    <aside
      aria-label="Queue"
      className="relative z-10 w-72 flex flex-col bg-gray-900/80 border-l border-gray-700 shrink-0"
    >
      {/* Queue */}
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-3">
          {t('tv.queueLabel')}
          {queue.length > 0 && (
            <span className="ml-1.5 text-gray-600 normal-case tracking-normal">
              ({queue.length})
            </span>
          )}
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-2 items-center animate-pulse">
                <div className="w-4 h-3 bg-gray-700 rounded shrink-0" />
                <div className="w-14 h-8 bg-gray-700 rounded shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 bg-gray-700 rounded w-full" />
                  <div className="h-2.5 bg-gray-700 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : queue.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-8">
            {t('tv.emptyQueueMessage')}
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.map((item, i) => (
              <li key={item.queueId} className="flex gap-2 items-center">
                <span className="text-xs text-gray-600 w-4 shrink-0 text-right">
                  {i + 1}
                </span>
                <div className="relative w-14 h-8 shrink-0 rounded overflow-hidden bg-gray-800">
                  <Image
                    src={item.thumbnail}
                    alt={item.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-200 line-clamp-2 leading-tight">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{item.channel}</p>
                  {item.requesterName && (
                    <span className="mt-0.5 inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-medium truncate">
                      <Mic size={9} className="shrink-0" />
                      <span className="truncate">{item.requesterName}</span>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* End Party */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={onEndParty}
          className="w-full py-2 text-xs text-gray-600 hover:text-red-400 hover:border-red-800 border border-gray-800 rounded-lg transition-colors"
        >
          {t('tv.endPartyButton')}
        </button>
      </div>
    </aside>
  );
}
