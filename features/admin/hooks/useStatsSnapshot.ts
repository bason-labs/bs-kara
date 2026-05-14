'use client';

import { useEffect, useState } from 'react';
import type { StatsSnapshot } from '@/app/api/admin/stats/route';

const POLL_INTERVAL_MS = 30_000;

interface UseStatsSnapshotResult {
  data: StatsSnapshot | null;
  loading: boolean;
  error: string | null;
}

export function useStatsSnapshot(): UseStatsSnapshotResult {
  const [data, setData] = useState<StatsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function doFetch() {
      setLoading(true);
      setError(null);
      fetch('/api/admin/stats', { headers: { 'Cache-Control': 'no-store' } })
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
          setData((await res.json()) as StatsSnapshot);
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
