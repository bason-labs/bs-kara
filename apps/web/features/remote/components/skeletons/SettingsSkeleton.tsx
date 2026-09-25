import { SkeletonBox } from './SkeletonBox';

function SkeletonSection({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 mb-2.5">
        <SkeletonBox className="w-[13px] h-[13px] rounded-sm" />
        <SkeletonBox className="h-[11px] w-[35%] rounded-sm" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 rounded-2xl border border-border bg-surface-2/40"
        >
          <div className="flex flex-col gap-1.5 flex-1">
            <SkeletonBox className="h-[11px] w-[55%] rounded-sm" />
            <SkeletonBox className="h-[9px] w-[75%] rounded-sm" />
          </div>
          <SkeletonBox className="w-11 h-6 rounded-full ml-3 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div data-testid="settings-skeleton" aria-hidden="true" className="px-5 py-5 space-y-6">
      <SkeletonSection rows={2} />
      <SkeletonSection rows={3} />
      <SkeletonSection rows={2} />
    </div>
  );
}
