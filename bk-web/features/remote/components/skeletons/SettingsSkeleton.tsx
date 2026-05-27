function SkeletonSection({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      <div className="h-[13px] w-[40%] rounded-sm bg-surface-2 animate-shimmer" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3 rounded-2xl border border-border"
        >
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="h-[11px] w-[55%] rounded-sm bg-surface-2 animate-shimmer" />
            <div className="h-[9px] w-[75%] rounded-sm bg-surface-2 animate-shimmer" />
          </div>
          <div className="w-11 h-6 rounded-full bg-surface-2 animate-shimmer ml-3 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div aria-hidden="true" className="px-5 py-5 space-y-6">
      <SkeletonSection rows={2} />
      <SkeletonSection rows={3} />
      <SkeletonSection rows={2} />
    </div>
  );
}
