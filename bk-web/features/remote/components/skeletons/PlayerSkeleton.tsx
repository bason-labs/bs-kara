import { SkeletonBox } from './SkeletonBox';

export function PlayerSkeleton() {
  return (
    <div data-testid="player-skeleton" aria-hidden="true" className="flex flex-col h-full">
      {/* Hero card — vertically centered in the remaining space.
          The inner column declares `w-full max-w-[320px]` so the
          aspect-video thumbnail has a concrete width to size against.
          The real NowPlayingCard hero uses the same template but
          dodges the chicken-and-egg via its `<Image fill>` providing
          intrinsic dimensions; the skeleton has no image so the inner
          width must be explicit. */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-[320px] flex flex-col items-center gap-4">
          <SkeletonBox className="w-full aspect-video rounded-3xl" />
          <div className="w-full flex flex-col items-center gap-2">
            <SkeletonBox className="h-[10px] w-[30%] rounded-sm" />
            <SkeletonBox className="h-[14px] w-[85%] rounded-sm" />
            <SkeletonBox className="h-[11px] w-[55%] rounded-sm" />
          </div>
        </div>
      </div>

      {/* EmojiPad row */}
      <div className="shrink-0 bg-surface/85 backdrop-blur-md border-t border-border">
        <div className="flex justify-around items-center gap-1 px-3 py-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBox key={i} className="w-11 h-11 rounded-full" />
          ))}
        </div>
      </div>

      {/* RemoteControls row */}
      <div className="shrink-0 border-t border-border/60 px-4 py-4">
        <div className="flex items-center justify-center gap-5">
          <SkeletonBox className="w-11 h-11 rounded-full" />
          <SkeletonBox className="w-16 h-16 rounded-full" />
          <SkeletonBox className="w-11 h-11 rounded-full" />
        </div>
      </div>
    </div>
  );
}
