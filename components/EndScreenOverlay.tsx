'use client';

import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

interface EndScreenOverlayProps {
  // YouTube player handle. Must expose getCurrentTime + getDuration; we
  // poll these to detect "near end" instead of using a setTimeout from
  // song start, so seeking does not desync the trigger.
  player: { getCurrentTime: () => number; getDuration: () => number } | null;
  // Resets overlay state on song change.
  songId: string | null;
  // Optional next-song teaser shown in the footer.
  nextSongTitle?: string | null;
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

const TRIGGER_SECONDS_BEFORE_END = 5;
const POLL_INTERVAL_MS = 250;
const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181'];

function pickMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

export function EndScreenOverlay({ player, songId, nextSongTitle }: EndScreenOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(pickMessage);

  useEffect(() => {
    setVisible(false);
    setMessage(pickMessage());
  }, [songId]);

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
      className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none"
      style={{
        background:
          'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.85) 100%)',
        animation: 'end-overlay-fade-in 0.4s ease-out',
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
          className="text-6xl md:text-8xl font-black mb-6 tracking-tight"
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
          className="text-2xl md:text-4xl font-semibold text-white"
          style={{
            textShadow: '0 2px 12px rgba(0, 0, 0, 0.8)',
            animation: 'end-overlay-emoji-pulse 1.2s ease-in-out infinite',
          }}
        >
          {message.subline}
        </div>
      </div>

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
