'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SubscriptionRecord } from '@/lib/subscriptions/schema';

interface UseSubscriptionsResult {
  data: SubscriptionRecord[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSubscriptions(): UseSubscriptionsResult {
  const [data, setData] = useState<SubscriptionRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bump on refetch() to re-run the effect. Simpler than juggling AbortControllers
  // for a list whose dataset is small and request is cheap.
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset state at the start of every fetch tick (mount + refetch)
    setLoading(true);
    setError(null);
    fetch('/api/admin/subscriptions', {
      method: 'GET',
      headers: { 'Cache-Control': 'no-store' },
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          let msg = res.statusText || `HTTP ${res.status}`;
          try {
            const body = (await res.json()) as { error?: unknown };
            if (typeof body.error === 'string') msg = body.error;
          } catch {
            // body wasn't JSON; keep statusText
          }
          setError(msg);
          setData(null);
          setLoading(false);
          return;
        }
        const body = (await res.json()) as SubscriptionRecord[];
        setData(body);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'network_error');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { data, loading, error, refetch };
}
