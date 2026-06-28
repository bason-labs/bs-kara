'use client';

import { Coffee } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AdIntermissionOverlayProps {
  // Sizing preset, mirroring MCAnnouncementOverlay. TV stacks at z-10 with
  // larger type; phone stacks at z-[8] below its tap layer.
  variant: 'tv' | 'phone';
  nextSongTitle?: string | null;
}

const VARIANTS = {
  tv: {
    container:
      'absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-8 text-center bg-black',
    iconSize: 28,
    title: 'text-3xl font-bold text-white',
    subtitle: 'text-sm text-gray-300 max-w-2xl',
    nextUp: 'text-base text-pink-200',
  },
  phone: {
    container:
      'absolute inset-0 z-[8] flex flex-col items-center justify-center gap-4 px-6 text-center bg-black',
    iconSize: 22,
    title: 'text-xl sm:text-2xl font-bold text-white',
    subtitle: 'text-xs sm:text-sm text-gray-300 max-w-xl',
    nextUp: 'text-sm text-pink-200',
  },
} as const;

export function AdIntermissionOverlay({ variant, nextSongTitle }: AdIntermissionOverlayProps) {
  const { t } = useTranslation();
  const v = VARIANTS[variant];
  return (
    <div className={v.container}>
      <Coffee size={v.iconSize} className="text-pink-300 animate-pulse" />
      <p className={v.title}>{t('adMask.title')}</p>
      <p className={v.subtitle}>{t('adMask.subtitle')}</p>
      {nextSongTitle && (
        <p className={v.nextUp}>
          {t('adMask.nextUp')}{' '}
          <span className="text-white font-semibold">{nextSongTitle}</span>
        </p>
      )}
    </div>
  );
}
