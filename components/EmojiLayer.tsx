'use client';

import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { ref, onChildAdded, query, orderByChild, startAfter } from 'firebase/database';
import { db } from '@/lib/firebase';
import { getRoomDataPath } from '@/lib/roomPaths';
import { getGifUrl } from '@/lib/reactions';

interface IncomingReaction {
  reactionId: string;
  emojiType: string;
}

interface ActiveReaction {
  id: string;
  emoji: string;
  leftPct: number;
  sway: number;
  rotation: number;
  scalePeak: number;
  duration: number;
}

interface EmojiLayerProps {
  roomId: string;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function buildActive(item: IncomingReaction): ActiveReaction {
  const swayMag = rand(45, 90);
  return {
    id: item.reactionId,
    emoji: item.emojiType,
    leftPct: rand(8, 92),
    sway: Math.random() < 0.5 ? -swayMag : swayMag,
    rotation: rand(-22, 22),
    scalePeak: rand(0.95, 1.4),
    duration: rand(4.2, 5.6),
  };
}

export function EmojiLayer({ roomId }: EmojiLayerProps) {
  const [reactionQueue, setReactionQueue] = useState<IncomingReaction[]>([]);
  const [activeElements, setActiveElements] = useState<ActiveReaction[]>([]);
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const removeActive = useCallback((id: string) => {
    setActiveElements((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Listener: enqueue only — never render directly
  useEffect(() => {
    const q = query(
      ref(db, `${getRoomDataPath(roomId)}/emojis`),
      orderByChild('timestamp'),
      startAfter(Date.now()),
    );

    const unsub = onChildAdded(q, (snap) => {
      const data = snap.val() as { emoji?: string; timestamp?: number } | null;
      if (!data?.emoji) return;
      setReactionQueue((prev) => [
        ...prev,
        { reactionId: snap.key!, emojiType: data.emoji! },
      ]);
    });

    return unsub;
  }, [roomId]);

  // Drain loop: pop one reaction every 150–250ms so they appear staggered
  // even when many arrive in the same tick.
  useEffect(() => {
    if (reactionQueue.length === 0 || drainTimerRef.current) return;

    const head = reactionQueue[0];
    const stagger = rand(150, 250);

    drainTimerRef.current = setTimeout(() => {
      drainTimerRef.current = null;
      const reaction = buildActive(head);
      setActiveElements((prev) => [...prev, reaction]);
      setReactionQueue((prev) => prev.slice(1));
      // Safety-net unmount; primary path is onAnimationEnd
      setTimeout(() => removeActive(reaction.id), reaction.duration * 1000 + 600);
    }, stagger);
  }, [reactionQueue, removeActive]);

  useEffect(() => {
    return () => {
      if (drainTimerRef.current) {
        clearTimeout(drainTimerRef.current);
        drainTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
      {activeElements.map((r) => {
        const style: CSSProperties = {
          left: `${r.leftPct}%`,
          marginLeft: '-32px',
          ['--sway' as string]: `${r.sway}px`,
          ['--rot' as string]: `${r.rotation}deg`,
          ['--scale-peak' as string]: `${r.scalePeak}`,
          animationDuration: `${r.duration}s`,
        };
        return (
          <span
            key={r.id}
            className="absolute bottom-[6vh] emoji-rise block"
            style={style}
            onAnimationEnd={() => removeActive(r.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getGifUrl(r.emoji)}
              alt={r.emoji}
              width={64}
              height={64}
              draggable={false}
              className="w-16 h-16 object-contain"
            />
          </span>
        );
      })}
    </div>
  );
}
