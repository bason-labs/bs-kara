'use client';

import { useEffect, useState } from 'react';
import type { SessionRecord } from '@/app/api/admin/sessions/route';

const POLL_INTERVAL_MS = 30_000;

interface UseSessionsDataResult {
  data: { sessions: SessionRecord[] } | null;
  loading: boolean;
  error: string | null;
}

export function useSessionsData(): UseSessionsDataResult {
  const [data, setData] = useState<{ sessions: SessionRecord[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function doFetch() {
      setLoading(true);
      setError(null);
      fetch('/api/admin/sessions', { headers: { 'Cache-Control': 'no-store' } })
        .then(async (res) => {
          if (cancelled) return;
          if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try {
              const body = (await res.json()) as { error?: unknown };
              if (typeof body.error === 'string') msg = body.error;
            } catch { /* body wasn't JSON */ }
            setError(msg);
            setData(null);
            setLoading(false);
            return;
          }
          setData((await res.json()) as { sessions: SessionRecord[] });
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'network_error');
          setLoading(false);
        });
    }

    doFetch();
    const interval = setInterval(doFetch, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { data, loading, error };
}
