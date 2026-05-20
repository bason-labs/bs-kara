'use client';

import { useTranslation } from 'react-i18next';
import { Mic, Pencil, Plus } from 'lucide-react';
import type { QueueItem } from '@/lib/youtube/types';

interface QueueItemBodyProps {
  item: QueueItem;
  onEditRequester?: (item: QueueItem) => void;
}

// Shared between the eager static queue and the lazy-loaded DnD queue so
// the requester pill behavior + a11y labels stay identical across both
// rendering paths.
export function QueueItemBody({ item, onEditRequester }: QueueItemBodyProps) {
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
