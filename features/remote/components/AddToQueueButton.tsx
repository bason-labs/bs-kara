'use client';

import { useTranslation } from 'react-i18next';
import { Check, Plus, X } from 'lucide-react';
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

  // Mobile (< lg) renders icon-only ~40×40 rounded-full so this button
  // pairs visually with the PlayNowButton next to it. Desktop (≥ lg)
  // keeps the original pill+text styling. Text labels stay in the DOM
  // (hidden lg:inline) so screen-reader users still read them on mobile,
  // and an aria-label is set on the idle button to cover the icon-only
  // path explicitly.
  if (isQueueLoading) {
    return (
      <button
        type="button"
        disabled
        aria-hidden="true"
        className="w-10 h-10 inline-flex items-center justify-center rounded-full border border-border text-muted bg-surface-2 opacity-60 transition-opacity duration-300 lg:w-auto lg:h-auto lg:px-3 lg:py-1 lg:text-xs lg:font-semibold lg:gap-1"
      >
        <span className="inline-block w-4 h-4 lg:w-3.5 lg:h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        <span className="hidden lg:inline">{t('search.addToQueueButton')}</span>
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
        className="group w-10 h-10 inline-flex items-center justify-center rounded-full border border-border text-muted bg-surface-2 hover:border-danger hover:text-danger hover:bg-surface transition-colors duration-200 lg:w-auto lg:h-auto lg:px-3 lg:py-1 lg:text-xs lg:font-semibold lg:gap-1"
      >
        <Check strokeWidth={2.4} className="w-4 h-4 lg:w-3.5 lg:h-3.5 group-hover:hidden" />
        <X strokeWidth={2.4} className="w-4 h-4 lg:w-3.5 lg:h-3.5 hidden group-hover:inline" />
        <span className="hidden lg:inline">{t('search.addedToQueueButton')}</span>
      </button>
    );
  }

  if (isCurrent) {
    return (
      <button
        type="button"
        disabled
        aria-label={t('search.addedToQueueButton')}
        className="w-10 h-10 inline-flex items-center justify-center rounded-full border border-border text-muted bg-surface-2 transition-colors duration-200 lg:w-auto lg:h-auto lg:px-3 lg:py-1 lg:text-xs lg:font-semibold lg:gap-1"
      >
        <Check strokeWidth={2.4} className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
        <span className="hidden lg:inline">{t('search.addedToQueueButton')}</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => onAdd(video)}
      aria-label={t('search.addToQueueButton')}
      className="w-10 h-10 inline-flex items-center justify-center text-white bg-gradient-brand rounded-full shadow-glow hover:brightness-110 active:scale-[0.97] transition duration-200 lg:w-auto lg:h-auto lg:px-3 lg:py-1 lg:text-xs lg:font-semibold"
    >
      <Plus strokeWidth={2.4} className="w-5 h-5 lg:hidden" />
      <span className="hidden lg:inline">{t('search.addToQueueButton')}</span>
    </button>
  );
}
