'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface UseScrollOffsetOptions {
  snapMs?: number;
  endDelayMs?: number;
}

interface UseScrollOffsetResult {
  offset: number;
  snap: boolean;
}

/* Drives a chrome-retraction value (in px) directly from a scroll
   container's vertical scroll delta. Each scroll tick adjusts `offset` by
   exactly the scroll delta — positive when scrolling down, negative when
   scrolling up — clamped to [0, maxOffset]. So consumers that translate
   their UI by `-offset` move 1:1 with the gesture: slow flicks retract
   slowly, fast flicks retract fast.

   When the scroll goes idle for `endDelayMs`, `offset` snaps to whichever
   endpoint is closer (0 or maxOffset) and `snap` flips to `true` for
   `snapMs` so consumers can apply a brief CSS transition over just that
   resting tween. During active scrolling `snap` is always false, so the
   gesture-coupled motion has no easing lag. Resuming a scroll mid-snap
   cancels it and re-couples to the gesture immediately. */
export function useScrollOffset(
  scrollRef: RefObject<HTMLElement | null>,
  maxOffset: number,
  { snapMs = 180, endDelayMs = 90 }: UseScrollOffsetOptions = {},
): UseScrollOffsetResult {
  const [offset, setOffset] = useState(0);
  const [snap, setSnap] = useState(false);

  const offsetRef = useRef(0);
  const lastYRef = useRef(0);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (offsetRef.current > maxOffset) {
      offsetRef.current = maxOffset;
      setOffset(maxOffset);
    }
    lastYRef.current = el.scrollTop;

    const onScroll = () => {
      // Cancel any in-flight snap so a resumed gesture re-couples 1:1
      // with the scroll position from this very next frame.
      setSnap(false);
      if (snapClearRef.current) {
        clearTimeout(snapClearRef.current);
        snapClearRef.current = null;
      }

      const y = el.scrollTop;
      const delta = y - lastYRef.current;
      lastYRef.current = y;

      // Pin the chrome fully extended whenever the scroll container is at
      // the top — even if a momentum frame arrives with a tiny positive
      // delta during overscroll bounce, we want offset back at 0.
      const next =
        y <= 0
          ? 0
          : Math.max(0, Math.min(maxOffset, offsetRef.current + delta));

      if (next !== offsetRef.current) {
        offsetRef.current = next;
        setOffset(next);
      }

      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      endTimerRef.current = setTimeout(() => {
        const cur = offsetRef.current;
        // Already at an endpoint — no snap needed, leave `snap` false so
        // we don't trigger a no-op transition class flip.
        if (cur <= 0 || cur >= maxOffset) return;
        const target = cur > maxOffset / 2 ? maxOffset : 0;
        setSnap(true);
        offsetRef.current = target;
        setOffset(target);
        if (snapClearRef.current) clearTimeout(snapClearRef.current);
        snapClearRef.current = setTimeout(() => setSnap(false), snapMs);
      }, endDelayMs);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      if (snapClearRef.current) clearTimeout(snapClearRef.current);
    };
  }, [scrollRef, maxOffset, snapMs, endDelayMs]);

  return { offset, snap };
}
