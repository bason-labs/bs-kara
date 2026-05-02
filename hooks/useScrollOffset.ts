'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface UseScrollOffsetOptions {
  snapMs?: number;
  endDelayMs?: number;
  /* Pixels from the top of the scroll container, and from the bottom, in
     which the chrome offset is held frozen. iOS rubber-band bounce fires
     phantom scroll events with bogus deltas at both edges; freezing in
     these zones avoids reading those values into the offset and toggling
     the chrome erratically. */
  edgePx?: number;
  /* Minimum |scrollDelta| (px) the handler will react to. Sub-threshold
     deltas are dropped *and* lastY is not advanced, so cumulative real
     movement still trips the gate eventually but micro-jitter doesn't
     thrash the offset. */
  minDeltaPx?: number;
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
   cancels it and re-couples to the gesture immediately.

   Two guard rails (edgePx, minDeltaPx) keep iOS Safari's rubber-band
   bounce from oscillating the chrome at scroll edges — the bounce can
   fire micro-deltas with the scroll position pinned at the boundary, and
   without these filters that thrash would freeze the page. Consumers
   should also set `overscroll-behavior-y: contain` on the scroll
   container so the bounce doesn't propagate up to the document. */
export function useScrollOffset(
  scrollRef: RefObject<HTMLElement | null>,
  maxOffset: number,
  {
    snapMs = 180,
    endDelayMs = 90,
    edgePx = 50,
    minDeltaPx = 5,
  }: UseScrollOffsetOptions = {},
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

      // Drop sub-threshold deltas without advancing lastY. Cumulative real
      // movement still trips the gate (delta is computed against the
      // older lastY), but iOS rubber-band micro-jitter is filtered out.
      // Skip this guard at exact top so we always pin to fully shown.
      if (y > 0 && Math.abs(delta) < minDeltaPx) return;

      lastYRef.current = y;

      const clientH = el.clientHeight;
      const scrollH = el.scrollHeight;
      const inTopEdge = y > 0 && y < edgePx;
      // Bottom-edge guard only kicks in once we have real measurements;
      // if the container hasn't laid out yet (clientHeight = 0), don't
      // freeze.
      const inBottomEdge =
        clientH > 0 && scrollH > 0 && y + clientH > scrollH - edgePx;

      let next: number;
      if (y <= 0) {
        // Pin to fully shown at the absolute top.
        next = 0;
      } else if (inTopEdge || inBottomEdge) {
        // Freeze in edge zones to ride out iOS rubber-band bounce.
        next = offsetRef.current;
      } else {
        next = Math.max(0, Math.min(maxOffset, offsetRef.current + delta));
      }

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
  }, [scrollRef, maxOffset, snapMs, endDelayMs, edgePx, minDeltaPx]);

  return { offset, snap };
}
