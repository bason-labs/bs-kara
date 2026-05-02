'use client';

import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MCAnnouncementOverlayProps {
  // Sizing/z-index preset. TV displays larger type and stacks at z-10; the
  // phone fullscreen player uses smaller type and stacks at z-[8] below
  // its tap layer.
  variant: 'tv' | 'phone';
  title: string;
  requesterName?: string;
  mcText?: string;
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
}: MCAnnouncementOverlayProps) {
  const { t } = useTranslation();
  const v = VARIANTS[variant];
  return (
    <div className={v.container}>
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
