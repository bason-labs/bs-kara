import { SkeletonBox } from './SkeletonBox';

export function QueueSkeleton() {
  return (
    <div data-testid="queue-skeleton" aria-hidden="true" className="h-full flex flex-col">
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
    </div>
  );
}
