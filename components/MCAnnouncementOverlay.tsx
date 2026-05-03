'use client';

import { Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MCAnnouncementOverlayProps {
  // Sizing/z-index preset. TV displays larger type and stacks at z-10; the
  // phone fullscreen player uses smaller type and stacks at z-[8] below
  // its tap layer.
  variant: 'tv' | 'phone';
  title: string;
  requesterName?: string;
  mcText?: string;
  // When provided, render a close button anchored top-right inside the
  // overlay. The FullscreenPlayer's own top bar is hidden while the MC
  // gate is active, so the close affordance has to live here for the
  // user to be able to leave fullscreen mid-announcement.
  onClose?: () => void;
}

const VARIANTS = {
  tv: {
    container: 'absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-8 text-center bg-black',
    pill: 'flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/20 border border-pink-400/40 text-pink-200 text-xs uppercase tracking-[0.3em]',
    sparkleSize: 14,
    title: 'text-3xl font-bold text-white max-w-3xl line-clamp-3',
    requester: 'text-base text-pink-200',
    mcText: 'text-sm text-gray-300 max-w-2xl italic',
  },
  phone: {
    container: 'absolute inset-0 z-[8] flex flex-col items-center justify-center gap-4 px-6 text-center bg-black',
    pill: 'flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/20 border border-pink-400/40 text-pink-200 text-[10px] uppercase tracking-[0.3em]',
    sparkleSize: 12,
    title: 'text-xl sm:text-2xl font-bold text-white max-w-2xl line-clamp-3',
    requester: 'text-sm text-pink-200',
    mcText: 'text-xs sm:text-sm text-gray-300 max-w-xl italic',
  },
} as const;

export function MCAnnouncementOverlay({
  variant,
  title,
  requesterName,
  mcText,
  onClose,
}: MCAnnouncementOverlayProps) {
  const { t } = useTranslation();
  const v = VARIANTS[variant];
  return (
    <div className={v.container}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('player.closeFullscreen')}
          className="absolute top-[max(0.5rem,env(safe-area-inset-top))] right-3 z-10 shrink-0 w-10 h-10 rounded-full bg-gradient-brand text-white shadow-glow flex items-center justify-center active:scale-95"
        >
          <X size={20} strokeWidth={2.4} />
        </button>
      )}
      <div className={v.pill}>
        <Sparkles size={v.sparkleSize} />
        {t('aiMc.announcing')}
      </div>
      <p className={v.title}>{title}</p>
      {requesterName && (
        <p className={v.requester}>
          {t('requester.tvLabel')}{' '}
          <span className="text-white font-semibold">{requesterName}</span>
        </p>
      )}
      {mcText && <p className={v.mcText}>“{mcText}”</p>}
    </div>
  );
}
