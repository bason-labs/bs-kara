export function PlayerSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-4 px-6 pt-6">
      <div className="w-full max-w-[320px] aspect-video rounded-3xl bg-surface-2 animate-shimmer" />
      <div className="w-full max-w-[320px] flex flex-col items-center gap-2">
        <div className="h-[14px] w-[85%] rounded-sm bg-surface-2 animate-shimmer" />
        <div className="h-[11px] w-[55%] rounded-sm bg-surface-2 animate-shimmer" />
      </div>
      <div className="flex gap-6 mt-2">
        <div className="w-11 h-11 rounded-full bg-surface-2 animate-shimmer" />
        <div className="w-11 h-11 rounded-full bg-surface-2 animate-shimmer" />
        <div className="w-11 h-11 rounded-full bg-surface-2 animate-shimmer" />
      </div>
    </div>
  );
}
