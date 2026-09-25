'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { getPublicOrigin } from '@/lib/publicOrigin';

interface IdleQRCodeProps {
  roomCode: string | null;
  // QR module pixel size — TV gets ~280, mobile fullscreen ~200.
  size?: number;
}

// Shared idle/empty-state QR. Lives on the TV's "no song" screen and on the
// mobile FullscreenPlayer when track is null. joinUrl is computed in an
// effect (not at render time) to avoid SSR hydration mismatches —
// getPublicOrigin() reads window.location.origin in the browser branch.
export function IdleQRCode({ roomCode, size = 240 }: IdleQRCodeProps) {
  const { t } = useTranslation();
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    const origin = getPublicOrigin() ?? window.location.origin;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJoinUrl(`${origin}/?room=${roomCode}`);
  }, [roomCode]);

  const cardPadding = 16;

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm sm:text-base text-gray-300">
        {t('tv.waitingMessage')}
      </p>

      <div
        className="bg-white rounded-2xl shadow-lg flex items-center justify-center"
        style={{ padding: cardPadding }}
      >
        {joinUrl ? (
          <QRCodeSVG value={joinUrl} size={size} level="M" />
        ) : (
          <div style={{ width: size, height: size }} />
        )}
      </div>

      <p className="text-sm sm:text-base font-medium text-white">
        {t('tv.scanToJoin')}
      </p>

      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.25em] text-gray-400">
          {t('header.roomLabel')}
        </span>
        <span
          className="tabular px-3 py-1 text-base font-bold text-white bg-gradient-brand rounded-full tracking-[0.3em] shadow-glow"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {roomCode ?? '----'}
        </span>
      </div>
    </div>
  );
}
