'use client';

import { useState } from 'react';
import { useAdminData } from '../context/AdminDataContext';
import { SubscriptionsTable } from './SubscriptionsTable';

export function SubscriptionsTableContainer() {
  const { subscriptions: { data, loading, error } } = useAdminData();
  // Sampled once on mount — table only renders after data arrives (client-side),
  // so there is no SSR hydration mismatch on relative-date cells.
  const [now] = useState(Date.now);

  if (loading) {
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
