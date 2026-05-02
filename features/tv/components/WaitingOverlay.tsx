'use client';

import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';

interface WaitingOverlayProps {
  roomCode: string | null;
  joinUrl: string | null;
  // Once true, the overlay fades out and stops absorbing pointer events.
  // The first interaction (tap or keypress) flips it.
  isInitialized: boolean;
  onActivate: () => void;
}

// Pre-init "Waiting Room" overlay. Lives at z-50 above the rest of the
// TV layout; clicking anywhere on it fires onActivate so the parent's
// post-init code paths (autoplay, MC, etc.) start inside a fresh user
// gesture.
export function WaitingOverlay({
  roomCode,
  joinUrl,
  isInitialized,
  onActivate,
}: WaitingOverlayProps) {
  const { t } = useTranslation();
  return (
    <section
      role="button"
      aria-label="Waiting room"
      onClick={onActivate}
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 text-white transition-opacity duration-700 ${
        isInitialized ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <h1 className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-4">
        {t('tv.heading')}
      </h1>
      <p className="text-2xl font-semibold text-gray-300 mb-2">
        {t('tv.roomLabel')}
      </p>
      <div className="text-8xl font-black tracking-[0.25em] tabular-nums mb-10">
        {roomCode ?? '----'}
      </div>

      {/* QR Code — scan to join */}
      <div className="bg-white p-4 rounded-2xl mb-4 shadow-lg">
        {joinUrl ? (
          <QRCodeSVG value={joinUrl} size={200} level="M" />
        ) : (
          <div className="w-[200px] h-[200px]" />
        )}
      </div>
      <p className="text-gray-400 text-sm font-medium leading-tight whitespace-pre-line text-center mb-10">
        {t('tv.qrHint')}
      </p>

      <p className="text-gray-500 text-sm animate-pulse">
        {t('tv.startPrompt')}
      </p>
    </section>
  );
}
