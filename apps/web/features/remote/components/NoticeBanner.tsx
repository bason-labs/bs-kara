// Floating status toast for transient room notices ("the room has ended", …).
export function NoticeBanner({ notice }: { notice: string | null }) {
  if (!notice) return null;
  return (
    <div className="fixed top-4 inset-x-0 z-[60] flex justify-center px-16 sm:px-4 pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className="max-w-md px-4 py-2.5 rounded-2xl sm:rounded-full bg-surface-2 border border-glow/40 shadow-glow text-sm text-fg text-center pointer-events-auto"
      >
        {notice}
      </div>
    </div>
  );
}
