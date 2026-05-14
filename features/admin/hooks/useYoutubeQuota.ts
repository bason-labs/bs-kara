'use client';

import { useEffect, useState } from 'react';
import type { YoutubeQuotaSnapshot } from '@/app/api/admin/quota/youtube/route';

const POLL_INTERVAL_MS = 60_000;

interface UseYoutubeQuotaResult {
  data: YoutubeQuotaSnapshot | null;
  loading: boolean;
  error: string | null;
}

export function useYoutubeQuota(): UseYoutubeQuotaResult {
  const [data, setData] = useState<YoutubeQuotaSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function doFetch() {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on each poll tick
      setLoading(true);
      setError(null);
      fetch('/api/admin/quota/youtube', { headers: { 'Cache-Control': 'no-store' } })
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
          setData((await res.json()) as YoutubeQuotaSnapshot);
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
