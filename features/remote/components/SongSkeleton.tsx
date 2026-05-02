export function SongSkeleton() {
  return (
    <div className="flex gap-3 p-3 bg-surface rounded-lg border border-border">
      <div className="w-28 h-16 flex-shrink-0 rounded bg-surface-2 animate-pulse" />
      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div className="space-y-1.5">
          <div className="h-3.5 w-11/12 rounded bg-surface-2 animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-surface-2 animate-pulse" />
        </div>
        <div className="flex items-center justify-end mt-1">
          <div className="h-6 w-24 rounded-full bg-surface-2 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
