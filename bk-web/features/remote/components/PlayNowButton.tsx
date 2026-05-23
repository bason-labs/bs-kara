'use client';

import { useTranslation } from 'react-i18next';
import { PlayCircle } from 'lucide-react';

interface PlayNowButtonProps {
  videoId: string;
  currentPlayingId?: string | null;
  onClick: () => void;
}

// Compact icon button placed next to the row's primary action. Renders
// nothing when the row is already playing — both for the search results
// and the queue, this keeps the row uncluttered and stops the user from
// trying to "play now" the song that's already playing.
//
// Visibility / sizing:
//   - Mobile (< lg): always visible, 40×40 rounded-full with bg-surface-2.
//     Sized to pair with the AddToQueueButton's mobile icon-only variant
//     so the row reads as two equal-weight controls instead of a small
//     icon next to a dominant pill.
//   - Desktop (≥ lg): hidden until the row is hovered (`group-hover`),
//     compact rounded-md with no background — mirrors the existing
//     hover-reveal pattern used elsewhere in the queue. The parent row
//     must carry the `group` class for the reveal to engage.
export function PlayNowButton({
  videoId,
  currentPlayingId,
  onClick,
}: PlayNowButtonProps) {
  const { t } = useTranslation();
  if (currentPlayingId === videoId) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={t('playNow.aria')}
      title={t('playNow.aria')}
      className="hidden lg:inline-flex shrink-0 items-center justify-center text-muted hover:text-fg transition-colors lg:w-auto lg:h-auto lg:p-1.5 lg:rounded-md lg:bg-transparent lg:hover:bg-surface-2 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 lg:transition-opacity"
    >
      <PlayCircle className="w-5 h-5 lg:w-4 lg:h-4" strokeWidth={2.2} />
    </button>
  );
}
