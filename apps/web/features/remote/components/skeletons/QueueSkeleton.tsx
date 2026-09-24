import { SkeletonBox } from './SkeletonBox';

export function QueueSkeleton() {
  return (
    <div data-testid="queue-skeleton" aria-hidden="true" className="h-full flex flex-col">
      {/* Desktop-only NowPlayingCard placeholder. RemoteClient renders the
          compact NowPlayingCard above the queue header on lg+; reserving the
          same slot here prevents the queue from jumping down when the real
          card arrives. Mobile keeps the slot collapsed since the queue tab
          never shows the card (it lives on the player tab instead). */}
      <div
        data-testid="queue-skeleton-now-playing"
        className="hidden lg:block px-3 pt-3 pb-1"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2/40 p-3">
          <SkeletonBox className="w-28 h-[72px] rounded-xl shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-1.5 py-0.5">
            <SkeletonBox className="h-[10px] w-[25%] rounded-sm" />
            <SkeletonBox className="h-[13px] w-[80%] rounded-sm" />
            <SkeletonBox className="h-[10px] w-[50%] rounded-sm" />
          </div>
          <SkeletonBox className="w-9 h-9 rounded-lg shrink-0" />
        </div>
      </div>

      {/* Sticky header placeholder mirroring ClientQueue */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 border-b border-border bg-bg/85 backdrop-blur-sm">
        <SkeletonBox className="h-[14px] w-[28%] rounded-sm" />
        <SkeletonBox className="h-[12px] w-8 rounded-full" />
      </div>

      {/* Scroll area with 5 row skeletons */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface"
          >
            <SkeletonBox className="w-4 h-4 rounded" />
            <SkeletonBox className="w-5 h-3 rounded-sm" />
            <SkeletonBox className="w-24 h-14 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <SkeletonBox className="h-[14px] w-[80%] rounded-sm" />
              <SkeletonBox className="h-[14px] w-[55%] rounded-sm" />
              <SkeletonBox className="h-[16px] w-[40%] rounded-full" />
            </div>
            <SkeletonBox className="w-[18px] h-[18px] rounded-sm shrink-0" />
          </div>
        ))}
      </div>

      {/* Desktop-only bottom strip. RemoteClient.tsx:658-672 wraps EmojiPad
          + RemoteControls in a single container that carries bg-surface/85,
          backdrop-blur-md and border-t border-border. Mirror that one parent
          here so the skeleton→loaded swap doesn't shift the tint over the
          controls area on desktop. */}
      <div
        data-testid="queue-skeleton-bottom-bar"
        className="hidden lg:block shrink-0 bg-surface/85 backdrop-blur-md border-t border-border"
      >
        <div
          data-testid="queue-skeleton-emoji-pad"
          className="flex justify-around items-center gap-1 px-3 py-2"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBox key={i} className="w-11 h-11 rounded-full" />
          ))}
        </div>
        <div
          data-testid="queue-skeleton-controls"
          className="shrink-0 border-t border-border/60 px-4 py-4"
        >
          <div className="flex items-center justify-center gap-5">
            <SkeletonBox className="w-11 h-11 rounded-full" />
            <SkeletonBox className="w-16 h-16 rounded-full" />
            <SkeletonBox className="w-11 h-11 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
