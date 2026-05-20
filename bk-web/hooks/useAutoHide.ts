'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* Returns `visible` (true while the user is active for `delayMs` after the
   last activity) plus a `bump` callback. Listeners on window cover mouse and
   keyboard, but iframes (e.g. the YouTube player) swallow taps in their own
   document — call `bump` from a tap layer to re-show chrome in those cases. */
export function useAutoHide(delayMs = 2500): { visible: boolean; bump: () => void } {
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bump = useCallback(() => {
    setVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), delayMs);
  }, [delayMs]);

  useEffect(() => {
    // `visible` starts true; just arm the initial hide timer without going
    // through bump() (calling a setState helper synchronously in an effect
    // trips the react-hooks/set-state-in-effect rule).
    timeoutRef.current = setTimeout(() => setVisible(false), delayMs);
    window.addEventListener('mousemove', bump);
    window.addEventListener('touchstart', bump, { passive: true });
    window.addEventListener('keydown', bump);
    return () => {
      window.removeEventListener('mousemove', bump);
      window.removeEventListener('touchstart', bump);
      window.removeEventListener('keydown', bump);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [bump, delayMs]);

  return { visible, bump };
}
