'use client';

import { useEffect, useState } from 'react';
import type { QueueOpsSnapshot } from '@/app/api/admin/queue-ops/route';


interface UseQueueOpsResult {
  data: QueueOpsSnapshot | null;
  loading: boolean;
  error: string | null;
}

export function useQueueOps(): UseQueueOpsResult {
  const [data, setData] = useState<QueueOpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function doFetch() {
      setLoading(true);
      setError(null);
      fetch('/api/admin/queue-ops', { headers: { 'Cache-Control': 'no-store' } })
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
          setData((await res.json()) as QueueOpsSnapshot);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'network_error');
          setLoading(false);
        });
    }

    doFetch();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
