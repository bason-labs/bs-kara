'use client';

interface RoomBlockedScreenProps {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

// Full-screen notice shown instead of a room that /api/room-access refused
// (expired subscription or unknown room). Used by the phone remote and the TV.
export function RoomBlockedScreen({ title, message, actionLabel, onAction }: RoomBlockedScreenProps) {
  return (
    <main
      role="alert"
      className="min-h-[100dvh] w-full flex flex-col items-center justify-center gap-3 bg-bg text-fg text-center px-6"
    >
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-sm text-muted mb-4">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="px-6 py-3 rounded-full bg-gradient-brand text-white font-semibold shadow-glow active:scale-95 transition-transform"
      >
        {actionLabel}
      </button>
    </main>
  );
}
