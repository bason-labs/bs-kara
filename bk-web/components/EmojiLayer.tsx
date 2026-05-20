'use client';

import {
  CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
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

export interface EmojiLayerHandle {
  pushLocal: (emoji: string) => void;
}

// Visible-cap: total active + queued reactions allowed at once. Drops the
// oldest in the queue when exceeded so a fresh tap is always shown.
const VISIBLE_CAP = 12;
// Local-key entries older than this are pruned. Sized comfortably above the
// expected Firebase echo round-trip (~300–600 ms).
const LOCAL_KEY_TTL_MS = 10_000;

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

export const EmojiLayer = forwardRef<EmojiLayerHandle, EmojiLayerProps>(
  function EmojiLayer({ roomId }, ref_) {
    const [reactionQueue, setReactionQueue] = useState<IncomingReaction[]>([]);
    const [activeElements, setActiveElements] = useState<ActiveReaction[]>([]);
    const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Self-echo dedupe. Key format: `${emoji}@${timestamp}@${counter}` where
    // counter is a per-instance monotonic so taps within the same ms stay
    // unique. Known limitation: two users tapping the SAME emoji on the SAME
    // millisecond on different devices will collide — one device will swallow
    // the other's echo. Acceptable: the cross-user collision window is ~1 ms
    // and the failure mode is one missed remote rise, not a crash.
    const localKeysRef = useRef<Map<string, number>>(new Map());
    const localCounterRef = useRef(0);

    const removeActive = useCallback((id: string) => {
      setActiveElements((prev) => prev.filter((r) => r.id !== id));
    }, []);

    const enqueue = useCallback((item: IncomingReaction) => {
      setReactionQueue((prev) => {
        const next = [...prev, item];
        // Drop-oldest cap covering queued + active so we can't backlog
        // animations after a spam burst. Active count is bounded by the same
        // policy via setActiveElements below.
        while (next.length > VISIBLE_CAP) next.shift();
        return next;
      });
    }, []);

    useImperativeHandle(
      ref_,
      () => ({
        pushLocal: (emoji: string) => {
          const ts = Date.now();
          const counter = ++localCounterRef.current;
          const dedupeKey = `${emoji}@${ts}@${counter}`;
          localKeysRef.current.set(dedupeKey, ts);
          enqueue({ reactionId: `local-${dedupeKey}`, emojiType: emoji });
        },
      }),
      [enqueue],
    );

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

        // Prune stale local-key entries before checking, so the Map doesn't
        // grow unbounded under sustained tapping.
        const now = Date.now();
        for (const [k, t] of localKeysRef.current) {
          if (now - t > LOCAL_KEY_TTL_MS) localKeysRef.current.delete(k);
        }

        // Self-echo dedupe: if any local key matches this (emoji, timestamp),
        // consume it and skip enqueueing — we already showed it optimistically.
        if (typeof data.timestamp === 'number') {
          for (const [k, t] of localKeysRef.current) {
            if (t === data.timestamp && k.startsWith(`${data.emoji}@${data.timestamp}@`)) {
              localKeysRef.current.delete(k);
              return;
            }
          }
        }

        enqueue({ reactionId: snap.key!, emojiType: data.emoji! });
      });

      return unsub;
    }, [roomId, enqueue]);

    // Drain loop: pop one reaction every 150–250ms so they appear staggered
    // even when many arrive in the same tick.
    useEffect(() => {
      if (reactionQueue.length === 0 || drainTimerRef.current) return;

      const head = reactionQueue[0];
      const stagger = rand(150, 250);

      drainTimerRef.current = setTimeout(() => {
        drainTimerRef.current = null;
        const reaction = buildActive(head);
        setActiveElements((prev) => {
          const next = [...prev, reaction];
          while (next.length > VISIBLE_CAP) next.shift();
          return next;
        });
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
  },
);
