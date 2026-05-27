export function QueueSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3 p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[110px_1fr_44px] gap-3 p-3 rounded-[14px] border border-border"
        >
          <div className="w-[110px] h-[62px] rounded-lg bg-surface-2 animate-shimmer" />
          <div className="flex flex-col gap-2 pt-1">
            <div className="h-[10px] w-[92%] rounded-sm bg-surface-2 animate-shimmer" />
            <div className="h-[8px] w-[60%] rounded-sm bg-surface-2 animate-shimmer" />
          </div>
          <div className="w-11 h-11 rounded-full bg-surface-2 animate-shimmer" />
        </div>
      ))}
    </div>
  );
}
