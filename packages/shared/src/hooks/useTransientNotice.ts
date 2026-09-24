import { useCallback, useEffect, useRef, useState } from 'react';

// A self-clearing notice. show(msg) sets the message and schedules a
// `setNull` after `durationMs`. Calling show again resets the timer so
// rapid back-to-back notices don't get clipped by a stale timeout.
// Cleans up its pending timer on unmount.
export function useTransientNotice(durationMs: number) {
  const [notice, setNotice] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string) => {
      setNotice(message);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setNotice(null), durationMs);
    },
    [durationMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { notice, show };
}
