'use client';

import { useTranslation } from 'react-i18next';
import { roomAccessMessage, type RoomAccessCheck } from '@bs-kara/shared/room-access';

interface RoomBlockedScreenProps {
  reason: Exclude<RoomAccessCheck, 'ok'>;
  isOwner?: boolean;
  actionLabel: string;
  onAction: () => void;
}

// Full-screen notice shown instead of a room that /api/room-access refused
// (expired subscription or unknown room). Used by the phone remote and the TV.
export function RoomBlockedScreen({ reason, isOwner, actionLabel, onAction }: RoomBlockedScreenProps) {
  const { t } = useTranslation();
  const { title, hint } = roomAccessMessage(reason, { isOwner });
  return (
    <main
      role="alert"
      className="min-h-[100dvh] w-full flex flex-col items-center justify-center gap-3 bg-bg text-fg text-center px-6"
    >
      <p className="text-lg font-semibold">{t(title)}</p>
      <p className="text-sm text-muted mb-4">{t(hint)}</p>
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
