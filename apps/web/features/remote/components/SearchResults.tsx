'use client';

import { memo } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Check, List, Plus, Sparkles } from 'lucide-react';
import type { YouTubeVideo } from '@bs-kara/shared';

interface ResultRowProps {
  video: YouTubeVideo;
  queuedMap?: Map<string, string>;
  queuePositionMap?: Map<string, number>;
  currentPlayingId?: string | null;
  justAddedId: string | null;
  onAdd: (video: YouTubeVideo) => void;
}

const ResultRow = memo(function ResultRow({
  video,
  queuedMap,
  queuePositionMap,
  currentPlayingId,
  justAddedId,
  onAdd,
}: ResultRowProps) {
  const { t } = useTranslation();

  const isNowPlaying = video.id === currentPlayingId;
  const queueId = queuedMap?.get(video.id);
  const isQueued = Boolean(queueId);
  const isJustAdded = video.id === justAddedId;
  const queuePos = queuePositionMap?.get(video.id);

  // Card border/background depends on the state. Order matters: now-playing
  // wins, then just-added (transient celebration), then queued.
  const cardClass = isNowPlaying
    ? 'bg-gradient-to-br from-brand/5 to-surface border-glow/55 shadow-glow'
    : isJustAdded
      ? 'bg-surface border-accent/70 animate-just-added'
      : isQueued
        ? 'bg-surface border-accent/35'
        : 'bg-surface border-border';

  // Status pill: only one renders at a time. Now-playing > just-added > queued.
  let statusPill: React.ReactNode = null;
  if (isNowPlaying) {
    statusPill = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-glow/18 text-glow text-[11px] mt-1 w-fit">
        <span className="w-[5px] h-[5px] rounded-full bg-glow animate-pulse" />
        {t('search.statusNowPlaying')}
      </span>
    );
  } else if (isJustAdded) {
    statusPill = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/18 text-accent text-[11px] mt-1 w-fit">
        <Sparkles size={11} />
        {t('search.statusJustAdded')}
      </span>
    );
  } else if (isQueued) {
    statusPill = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[11px] mt-1 w-fit">
        <List size={11} />
        {t('search.statusQueued', { pos: queuePos })}
      </span>
    );
  }

  // Action button: idle (add), claimed (check, disabled), now-playing (check, disabled).
  let actionButton: React.ReactNode;
  if (isNowPlaying) {
    actionButton = (
      <button
        type="button"
        disabled
        aria-label={t('search.statusNowPlaying')}
        className="w-11 h-11 flex items-center justify-center rounded-full bg-transparent text-glow border border-glow/40 cursor-not-allowed"
      >
        <Check size={20} />
      </button>
    );
  } else if (isQueued || isJustAdded) {
    actionButton = (
      <div
        aria-label={isJustAdded ? t('search.statusJustAdded') : t('search.statusQueued', { pos: queuePos })}
        className="w-11 h-11 flex items-center justify-center rounded-full bg-surface-2 text-accent border border-accent/30 cursor-default"
      >
        <Check size={20} />
      </div>
    );
  } else {
    actionButton = (
      <button
        type="button"
        onClick={() => onAdd(video)}
        aria-label={t('search.addAriaLabel', { defaultValue: 'Add' })}
        className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-brand text-white shadow-glow active:scale-[0.92] transition-transform"
      >
        <Plus size={22} />
      </button>
    );
  }

  return (
    <div
      className={`grid grid-cols-[110px_1fr_44px] gap-3 p-3 rounded-[14px] border transition-colors ${cardClass}`}
    >
      {/* Thumbnail */}
      <div className="relative w-[110px] h-[62px] rounded-lg overflow-hidden bg-surface-2">
        <Image
          src={video.thumbnail}
          alt={video.title}
          fill
          className="object-cover"
          unoptimized
        />
        {video.duration && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/78 text-white text-[11px] font-semibold tabular-nums rounded">
            {video.duration}
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col justify-between min-w-0">
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-[14.5px] font-semibold text-fg leading-[1.35] line-clamp-2">
            {video.title}
          </p>
          <p className="text-[11.5px] text-muted mt-0.5 truncate">{video.channel}</p>
        </div>
        {statusPill}
      </div>

      {/* Action */}
      <div className="flex items-center justify-center">{actionButton}</div>
    </div>
  );
});

interface SearchResultsProps {
  results: YouTubeVideo[];
  queuedMap?: Map<string, string>;
  queuePositionMap?: Map<string, number>;
  currentPlayingId?: string | null;
  justAddedId: string | null;
  onAdd: (video: YouTubeVideo) => void;
}

// React.memo so the up-to-15 result cards (each with an <Image>) don't
// re-render on unrelated SearchPanel state changes (typing, focus, etc.).
export const SearchResults = memo(function SearchResults({
  results,
  queuedMap,
  queuePositionMap,
  currentPlayingId,
  justAddedId,
  onAdd,
}: SearchResultsProps) {
  return (
    <div className="space-y-3">
      {results.map((video) => (
        <ResultRow
          key={video.id}
          video={video}
          queuedMap={queuedMap}
          queuePositionMap={queuePositionMap}
          currentPlayingId={currentPlayingId}
          justAddedId={justAddedId}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
});
