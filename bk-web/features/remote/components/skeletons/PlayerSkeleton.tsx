import { SkeletonBox } from './SkeletonBox';

export function PlayerSkeleton() {
  return (
    <div data-testid="player-skeleton" aria-hidden="true" className="flex flex-col items-center gap-4 px-6 pt-6">
      {/* Thumbnail — mirrors the aspect-video rounded-3xl container in the hero variant */}
      <SkeletonBox className="w-full max-w-[320px] aspect-video rounded-3xl" />
      {/* Text block — label pill + title + channel */}
      <div className="w-full max-w-[320px] flex flex-col items-center gap-2">
        <SkeletonBox className="h-[10px] w-[30%] rounded-sm" />
        <SkeletonBox className="h-[14px] w-[85%] rounded-sm" />
        <SkeletonBox className="h-[11px] w-[55%] rounded-sm" />
      </div>
    </div>
  );
}
