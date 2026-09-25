'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DerivedStatus,
  SubscriptionRecord,
} from '@/lib/subscriptions/schema';

export interface SubscriptionDetailData {
  record: SubscriptionRecord;
  derivedStatus: DerivedStatus;
  daysLeft: number;
}

interface UseSubscriptionDetailResult {
  data: SubscriptionDetailData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const NOT_FOUND_MESSAGE = 'Không tìm thấy gói đăng ký.';
const GENERIC_FAILURE = 'Không thể tải gói đăng ký. Vui lòng thử lại.';

export function useSubscriptionDetail(
  id: string,
): UseSubscriptionDetailResult {
  const [data, setData] = useState<SubscriptionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- early-exit for empty id; render error state without firing a fetch
      setError(NOT_FOUND_MESSAGE);
      setLoading(false);
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/admin/subscriptions/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-store' },
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setError(NOT_FOUND_MESSAGE);
          setData(null);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          let msg: string = GENERIC_FAILURE;
          try {
            const body = (await res.json()) as { error?: unknown };
            if (typeof body.error === 'string') msg = body.error;
          } catch {
            // body wasn't JSON
          }
          setError(msg);
          setData(null);
          setLoading(false);
          return;
        }
        const body = (await res.json()) as SubscriptionDetailData;
        setData(body);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : GENERIC_FAILURE);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  return { data, loading, error, refetch };
}
