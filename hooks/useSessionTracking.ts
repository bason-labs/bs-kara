'use client';

import { useEffect, useRef } from 'react';

export function useSessionTracking(roomId: string | null): void {
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    fetch('/api/room/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    })
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as { sessionId?: string };
        if (data.sessionId) sessionIdRef.current = data.sessionId;
      })
      .catch(() => {}); // analytics failure must never affect room functionality

    return () => {
      cancelled = true;
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      sessionIdRef.current = null;
      // keepalive so the request survives component teardown / page unload
      fetch('/api/room/leave', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    };
  }, [roomId]);
}
