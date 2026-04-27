'use client';

import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Maximize2 } from 'lucide-react';
import { YouTubeVideo } from '@/lib/youtube';

interface NowPlayingCardProps {
  track: YouTubeVideo | null;
  isPlaying?: boolean;
  onExpand?: () => void;
  className?: string;
}

export function NowPlayingCard({
  track,
  isPlaying = true,
  onExpand,
  className = '',
}: NowPlayingCardProps) {
  const { t } = useTranslation();
  if (!track) return null;

  return (
    <div
      className={`relative flex items-center gap-3 rounded-2xl border border-glow/40 bg-surface-2 p-3 shadow-glow ${className}`}
    >
      <div className="relative w-20 h-12 shrink-0 rounded-lg overflow-hidden bg-surface">
        <Image
          src={track.thumbnail}
          alt={track.title}
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-glow font-semibold">
          {t('nowPlaying.label')}
        </p>
        <p className="text-sm font-medium text-fg line-clamp-1 leading-tight">{track.title}</p>
        <p className="text-xs text-muted truncate">{track.channel}</p>
      </div>

      <div
        aria-hidden="true"
        data-playing={isPlaying ? 'true' : 'false'}
        className="now-eq shrink-0 flex items-end gap-0.5 h-5 w-5"
      >
        <i />
        <i />
        <i />
      </div>

      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          aria-label={t('player.openFullscreen')}
          className="shrink-0 ml-1 p-2 rounded-lg text-muted hover:text-fg hover:bg-surface transition-colors"
        >
          <Maximize2 size={16} />
        </button>
      )}

      <style>{`
        .now-eq i {
          display: block;
          width: 3px;
          background: var(--glow);
          border-radius: 2px;
          height: 30%;
          transform-origin: bottom;
        }
        .now-eq[data-playing='true'] i {
          animation: nowEq 0.9s ease-in-out infinite;
        }
        .now-eq[data-playing='true'] i:nth-child(2) {
          animation-delay: 0.15s;
        }
        .now-eq[data-playing='true'] i:nth-child(3) {
          animation-delay: 0.3s;
        }
        @keyframes nowEq {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
