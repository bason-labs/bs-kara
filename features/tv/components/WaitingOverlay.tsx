'use client';

import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';

interface WaitingOverlayProps {
  roomCode: string | null;
  joinUrl: string | null;
  isInitialized: boolean;
  onActivate: () => void;
  guestsAllowed: boolean;
  onToggleGuests: (enabled: boolean) => void;
}

// Pre-init "Waiting Room" overlay. Lives at z-50 above the rest of the
// TV layout; clicking anywhere on it fires onActivate so the parent's
// post-init code paths (autoplay, MC, etc.) start inside a fresh user
// gesture. The "allow guests" toggle is stopPropagation-guarded so
// flipping it does not also initialise the room.
export function WaitingOverlay({
  roomCode,
  joinUrl,
  isInitialized,
  onActivate,
  guestsAllowed,
  onToggleGuests,
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
      <p className="text-gray-400 text-sm font-medium leading-tight whitespace-pre-line text-center mb-6">
        {t('tv.qrHint')}
      </p>

      {/* Allow guests toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={guestsAllowed}
        onClick={(e) => {
          e.stopPropagation();
          onToggleGuests(!guestsAllowed);
        }}
        className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors mb-6"
      >
        <span className="text-sm text-gray-300">Cho phép khách tham gia</span>
        <span
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            guestsAllowed ? 'bg-green-500' : 'bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              guestsAllowed ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </span>
      </button>

      <p className="text-gray-500 text-sm animate-pulse">
        {t('tv.startPrompt')}
      </p>
    </section>
  );
}
