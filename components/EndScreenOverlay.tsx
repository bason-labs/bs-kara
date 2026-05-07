'use client';

import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import type { ScoreResult } from '@/lib/scoring';
import { ScoreBlock } from '@/components/ScoreBlock';

interface EndScreenOverlayProps {
  // YouTube player handle. Must expose getCurrentTime + getDuration; we
  // poll these to detect "near end" instead of using a setTimeout from
  // song start, so seeking does not desync the trigger.
  player: { getCurrentTime: () => number; getDuration: () => number } | null;
  // Resets overlay state on song change.
  songId: string | null;
  // Optional next-song teaser shown in the footer.
  nextSongTitle?: string | null;
  // Fires whenever the overlay's own visibility flips. Parents use this
  // to drive transport-control hide/show while the outro is up.
  onVisibleChange?: (visible: boolean) => void;
  // Live AI score for the song. When provided, ScoreBlock renders inside
  // the overlay between the headline subline and the footer teaser. Null
  // / undefined → no scoring UI rendered (toggle is off, or no song).
  // Inherits the overlay's 8s visibility gate by being part of its tree.
  score?: ScoreResult | null;
}

const MESSAGES = [
  { headline: '🎤 Bạn hát tuyệt vời!', subline: 'Cả phòng vỗ tay nào! 👏' },
  { headline: '⭐ Như ca sĩ luôn!', subline: 'Một tràng pháo tay! 👏👏👏' },
  { headline: '🔥 Cháy quá!', subline: 'Cùng cụng ly nào! 🥂' },
  { headline: '🎵 Giọng vàng đó nha!', subline: 'Tuyệt vời ông mặt trời! ☀️' },
  { headline: '✨ Hát hay quá!', subline: 'Vỗ tay khen người hát! 👏' },
  { headline: '💫 Diva phòng karaoke!', subline: 'Cả nhà cùng nhau vỗ tay! 👏👏' },
  { headline: '🏆 Quán quân phòng này!', subline: 'Bùng cháy hết mình! 🔥' },
  { headline: '🎉 Quá xuất sắc!', subline: 'Một bài hát đỉnh của đỉnh! ⭐' },
];

const TRIGGER_SECONDS_BEFORE_END = 8;
const POLL_INTERVAL_MS = 250;
const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181'];

function pickMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

export function EndScreenOverlay({
  player,
  songId,
  nextSongTitle,
  onVisibleChange,
  score,
}: EndScreenOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(pickMessage);

  useEffect(() => {
    setVisible(false);
    setMessage(pickMessage());
  }, [songId]);

  // Forward overlay visibility to the parent so it can drive transport-
  // control hide/show while the outro is up.
  useEffect(() => {
    onVisibleChange?.(visible);
  }, [visible, onVisibleChange]);

  useEffect(() => {
    if (!player || !songId) return;
    const id = window.setInterval(() => {
      const current = player.getCurrentTime();
      const duration = player.getDuration();
      // Skip very short clips — a 6-second video would otherwise spend
      // most of its life under the overlay.
      if (!duration || duration < TRIGGER_SECONDS_BEFORE_END * 2) return;
      const remaining = duration - current;
      if (remaining <= TRIGGER_SECONDS_BEFORE_END && remaining > 0) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [player, songId]);

  useEffect(() => {
    if (!visible) return;
    const fireBurst = () => {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { x: 0.2, y: 0.8 },
        colors: CONFETTI_COLORS,
      });
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { x: 0.8, y: 0.8 },
        colors: CONFETTI_COLORS,
      });
    };
    fireBurst();
    const t1 = window.setTimeout(fireBurst, 1500);
    const t2 = window.setTimeout(fireBurst, 3000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="outro-aurora-bg absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none"
      style={{
        // Two animations stacked: the existing fade-in for mount reveal +
        // the aurora cycle from .outro-aurora-bg. Inline `animation` would
        // otherwise shadow the utility's animation property.
        animation:
          'end-overlay-fade-in 0.4s ease-out, outroAurora 14s ease-in-out infinite',
      }}
    >
      <style>{`
        @keyframes end-overlay-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes end-overlay-headline-pop {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes end-overlay-emoji-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.2); }
        }
        @keyframes end-overlay-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      <div
        className="text-center px-8"
        style={{ animation: 'end-overlay-headline-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <div
          className="text-6xl md:text-8xl font-black mb-6 tracking-tight leading-tight pb-3"
          style={{
            backgroundImage:
              'linear-gradient(90deg, #FFD700 0%, #FFFFFF 25%, #FFD700 50%, #FFFFFF 75%, #FFD700 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'end-overlay-shimmer 3s linear infinite',
            textShadow: '0 4px 24px rgba(255, 215, 0, 0.4)',
          }}
        >
          {message.headline}
        </div>
        <div
          className="text-2xl md:text-4xl font-semibold text-white leading-tight pb-1"
          style={{
            textShadow: '0 2px 12px rgba(0, 0, 0, 0.8)',
            animation: 'end-overlay-emoji-pulse 1.2s ease-in-out infinite',
          }}
        >
          {message.subline}
        </div>
      </div>

      {score && (
        <div className="mt-8 pointer-events-none">
          <ScoreBlock score={score} />
        </div>
      )}

      <div
        className="absolute bottom-12 left-0 right-0 text-center text-white/80 text-base md:text-xl font-medium px-8"
        style={{
          textShadow: '0 2px 8px rgba(0, 0, 0, 0.9)',
          animation: 'end-overlay-fade-in 0.8s ease-out 0.6s both',
        }}
      >
        {nextSongTitle ? (
          <>
            🎵 Bài tiếp theo:{' '}
            <span className="font-bold text-white">{nextSongTitle}</span>
          </>
        ) : (
          '🎤 Cảm ơn đã hát!'
        )}
      </div>
    </div>
  );
}
