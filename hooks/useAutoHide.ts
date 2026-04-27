'use client';

import { useEffect, useRef, useState } from 'react';

/* Returns `true` while the user is active (mouse moved, touched, or pressed
   a key) and for `delayMs` after the last activity. Hides on idle. */
export function useAutoHide(delayMs = 2500): boolean {
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function bump() {
      setVisible(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setVisible(false), delayMs);
    }

    bump();
    window.addEventListener('mousemove', bump);
    window.addEventListener('touchstart', bump, { passive: true });
    window.addEventListener('keydown', bump);
    return () => {
      window.removeEventListener('mousemove', bump);
      window.removeEventListener('touchstart', bump);
      window.removeEventListener('keydown', bump);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [delayMs]);

  return visible;
}
