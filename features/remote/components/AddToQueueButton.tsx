'use client';

import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import type { YouTubeVideo } from '@/lib/youtube/types';

interface AddToQueueButtonProps {
  video: YouTubeVideo;
  isQueueLoading: boolean;
  queuedMap?: Map<string, string>;
  currentPlayingId?: string | null;
  onAdd: (video: YouTubeVideo) => void;
  onRemove?: (queueId: string) => void;
}

// Four mutually-exclusive states keyed off the queue snapshot:
//   1. Queue still loading       → disabled spinner placeholder
//   2. Already queued + onRemove → "Added" with hover-swap-to-X (clickable)
//   3. Currently playing         → "Added" disabled (cannot remove the now-
//                                  playing slot from the search panel)
//   4. Otherwise                 → primary "Add to queue" CTA
export function AddToQueueButton({
  video,
  isQueueLoading,
  queuedMap,
  currentPlayingId,
  onAdd,
  onRemove,
}: AddToQueueButtonProps) {
  const { t } = useTranslation();

  if (isQueueLoading) {
    return (
      <button
        type="button"
        disabled
        aria-hidden="true"
        className="px-4 py-1.5 text-sm lg:px-3 lg:py-1 lg:text-xs font-semibold rounded-full border border-border text-muted bg-surface-2 inline-flex items-center gap-1.5 lg:gap-1 opacity-60 transition-opacity duration-300"
      >
        <span className="inline-block w-4 h-4 lg:w-3.5 lg:h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        {t('search.addToQueueButton')}
      </button>
    );
  }

  const queueId = queuedMap?.get(video.id);
  const isCurrent = currentPlayingId === video.id;

  if (queueId && onRemove) {
    return (
      <button
        type="button"
        onClick={() => onRemove(queueId)}
        aria-label={t('search.addedToQueueButton')}
        className="group px-4 py-1.5 text-sm lg:px-3 lg:py-1 lg:text-xs font-semibold rounded-full border border-border text-muted bg-surface-2 inline-flex items-center gap-1.5 lg:gap-1 hover:border-danger hover:text-danger hover:bg-surface transition-colors duration-200"
      >
        <Check strokeWidth={2.4} className="w-4 h-4 lg:w-3.5 lg:h-3.5 group-hover:hidden" />
        <X strokeWidth={2.4} className="w-4 h-4 lg:w-3.5 lg:h-3.5 hidden group-hover:inline" />
        {t('search.addedToQueueButton')}
      </button>
    );
  }

  if (isCurrent) {
    return (
      <button
        type="button"
        disabled
        aria-label={t('search.addedToQueueButton')}
        className="px-4 py-1.5 text-sm lg:px-3 lg:py-1 lg:text-xs font-semibold rounded-full border border-border text-muted bg-surface-2 inline-flex items-center gap-1.5 lg:gap-1 transition-colors duration-200"
      >
        <Check strokeWidth={2.4} className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
        {t('search.addedToQueueButton')}
      </button>
    );
  }

  return (
    <button
      onClick={() => onAdd(video)}
      className="px-4 py-1.5 text-sm lg:px-3 lg:py-1 lg:text-xs font-semibold text-white bg-gradient-brand rounded-full shadow-glow hover:brightness-110 active:scale-[0.97] transition duration-200"
    >
      {t('search.addToQueueButton')}
    </button>
  );
}
