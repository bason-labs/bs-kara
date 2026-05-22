'use client';

const shimmer =
  'animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-surface-2 via-surface-3 to-surface-2';

export function SkeletonRow() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-[110px_1fr_44px] gap-3 p-3 bg-surface rounded-[14px] border border-border"
    >
      {/* Column 1 — thumbnail placeholder */}
      <div className={`w-[110px] h-[62px] rounded-lg ${shimmer}`} />

      {/* Column 2 — text lines */}
      <div className="flex flex-col gap-2 pt-1">
        <div className={`h-[10px] w-[92%] rounded-sm ${shimmer}`} />
        <div className={`h-[8px] w-[60%] rounded-sm ${shimmer}`} />
        <div className={`h-[8px] w-[40%] rounded-sm ${shimmer}`} />
      </div>

      {/* Column 3 — action placeholder */}
      <div className={`w-11 h-11 rounded-full ${shimmer}`} />
    </div>
  );
}
