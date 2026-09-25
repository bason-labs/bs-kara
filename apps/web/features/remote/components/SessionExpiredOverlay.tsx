'use client';

interface SessionExpiredOverlayProps {
  timedOut: boolean;
  rejoinReason: string | null;
  onRejoin: () => void;
}

// Full-screen overlay shown when useInactivityTimeout fires. `rejoinReason`
// is null until the first rejoin attempt. If the first rejoin succeeds, the
// overlay is dismissed (timedOut resets to false). If it fails, `rejoinReason`
// tells us why so we can swap the copy without navigating away.
export function SessionExpiredOverlay({
  timedOut,
  rejoinReason,
  onRejoin,
}: SessionExpiredOverlayProps) {
  if (!timedOut) return null;

  const isHardBlocked = rejoinReason === 'subscription_expired';

  let title = 'Phiên của bạn đã hết hạn do không hoạt động';
  if (rejoinReason === 'subscription_expired') {
    title = 'Phòng không còn hoạt động';
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg/95 backdrop-blur-md text-fg text-center px-6"
    >
      <p className="text-lg font-semibold mb-2">{title}</p>
      {!isHardBlocked && (
        <>
          <p className="text-sm text-muted mb-6">Nhấn để tiếp tục tham gia phòng.</p>
          <button
            type="button"
            onClick={onRejoin}
            className="px-6 py-3 rounded-full bg-gradient-brand text-white font-semibold shadow-glow active:scale-95 transition-transform"
          >
            Tham gia lại
          </button>
        </>
      )}
    </div>
  );
}
