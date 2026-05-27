import { SkeletonRow } from '../SkeletonRow';

export function SearchSkeleton() {
  return (
    <div data-testid="search-skeleton" aria-hidden="true" className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
