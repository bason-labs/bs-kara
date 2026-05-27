import { SkeletonBox } from './SkeletonBox';
import { SkeletonRow } from '../SkeletonRow';

export function SearchSkeleton() {
  return (
    <div data-testid="search-skeleton" aria-hidden="true" className="space-y-3 p-4">
      <div className="flex items-center gap-2 px-1 pb-1">
        <SkeletonBox className="w-[14px] h-[14px] rounded-sm" />
        <SkeletonBox className="h-[14px] w-[40%] rounded-sm" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
