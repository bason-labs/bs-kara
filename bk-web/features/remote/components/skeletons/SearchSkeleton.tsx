import { SkeletonBox } from './SkeletonBox';
import { SkeletonRow } from '../SkeletonRow';

export function SearchSkeleton() {
  return (
    <div
      data-testid="search-skeleton"
      aria-hidden="true"
      className="h-full flex flex-col"
    >
      {/* Search bar — mirrors the chrome at the top of SearchPanel so the
          input + mic snap into place when the real panel mounts. */}
      <div className="bg-bg/85 backdrop-blur-md border-b border-border">
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 h-[52px] px-4 bg-surface border border-border rounded-full flex-1 min-w-0">
              <SkeletonBox className="w-5 h-5 rounded-sm shrink-0" />
              <SkeletonBox className="flex-1 h-[14px] rounded-sm" />
              <SkeletonBox className="w-11 h-11 rounded-full shrink-0" />
            </div>
            <SkeletonBox className="w-10 h-10 rounded-full shrink-0" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 space-y-3">
        <div className="flex items-center gap-2 px-1 pb-1">
          <SkeletonBox className="w-[14px] h-[14px] rounded-sm" />
          <SkeletonBox className="h-[14px] w-[40%] rounded-sm" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}
