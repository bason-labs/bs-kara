'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const TAP_HIDE_MS = 2000;

/* While the end-of-song outro overlay is up, the transport controls (prev,
   next, play/pause) must be hidden by default and only re-appear on user
   interaction. This hook owns that visibility flag. Mouse hover toggles it
   live; touch taps show + auto-hide after a short idle window. Outside the
   outro state the hook is a no-op so callers can wire it unconditionally. */
export function useOutroControls(outroActive: boolean) {
  const [visible, setVisible] = useState(false);
  const tapHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTapHide = useCallback(() => {
    if (tapHideTimeoutRef.current !== null) {
      clearTimeout(tapHideTimeoutRef.current);
      tapHideTimeoutRef.current = null;
    }
  }, []);

  // Reset whenever the outro flips off — leftover state would strand the
  // controls in a half-shown state on the next song. The setState here is
  // a one-shot cleanup tied to an external transition (outro end), not a
  // render-derived value, so the cascading-render concern doesn't apply.
  useEffect(() => {
    if (!outroActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      clearTapHide();
    }
  }, [outroActive, clearTapHide]);

  useEffect(() => () => clearTapHide(), [clearTapHide]);

  const handleMouseEnter = useCallback(() => {
    if (!outroActive) return;
    clearTapHide();
    setVisible(true);
  }, [outroActive, clearTapHide]);

  const handleMouseLeave = useCallback(() => {
    if (!outroActive) return;
    clearTapHide();
    setVisible(false);
  }, [outroActive, clearTapHide]);

  // Touch path: tap shows; auto-hide after TAP_HIDE_MS of no further input.
  // Mouse clicks fall through to hover semantics — no auto-hide timer set,
  // because mouseleave already handles "user moved away".
  const handlePointerDown = useCallback(
    (e: { pointerType?: string }) => {
      if (!outroActive) return;
      clearTapHide();
      setVisible(true);
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        tapHideTimeoutRef.current = setTimeout(() => {
          setVisible(false);
          tapHideTimeoutRef.current = null;
        }, TAP_HIDE_MS);
      }
    },
    [outroActive, clearTapHide],
  );

  // Keyboard path: focusing a control surfaces it even if the mouse is
  // nowhere near. Pairs with `:focus-within` on the wrapper for the case
  // where the focus arrives after this hook missed the event.
  const handleFocusIn = useCallback(() => {
    if (!outroActive) return;
    clearTapHide();
    setVisible(true);
  }, [outroActive, clearTapHide]);

  return {
    visible,
    handleMouseEnter,
    handleMouseLeave,
    handlePointerDown,
    handleFocusIn,
  };
}
