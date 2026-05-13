'use client';

import { useEffect, useState } from 'react';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { SubscriptionsTable } from './SubscriptionsTable';

export function SubscriptionsTableContainer() {
  const { data, loading, error } = useSubscriptions();
  // Sample `now` once on mount so derive() output is stable across renders
  // AND so SSR doesn't bake a server-side Date.now() into the markup (which
  // would hydration-mismatch against the client). We deliberately render a
  // loading state until the effect runs.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client-side clock sample to avoid SSR hydration mismatch
    setNow(Date.now());
  }, []);

  if (loading || now === null) {
    return (
      <p className="text-sm text-muted" role="status">
        Đang tải…
      </p>
    );
  }
  if (error) {
    return (
      <p className="text-sm text-danger" role="alert">
        Lỗi tải dữ liệu: {error}
      </p>
    );
  }
  return <SubscriptionsTable data={data ?? []} now={now} />;
}
