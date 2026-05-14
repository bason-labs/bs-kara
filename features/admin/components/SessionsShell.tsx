'use client';

import { useEffect, useState } from 'react';
import { useSessionsData } from '../hooks/useSessionsData';
import { SessionsTable } from './SessionsTable';

export function SessionsShell() {
  const { data, loading, error } = useSessionsData();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount flag for hydration guard
    setMounted(true);
  }, []);

  if (!mounted || loading) {
    return <p className="text-sm text-muted" role="status">Đang tải…</p>;
  }

  if (error) {
    return <p className="text-sm text-danger" role="alert">Lỗi tải phiên: {error}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Hiển thị tối đa 200 phiên gần nhất. Múi giờ: ICT (Asia/Ho_Chi_Minh).
      </p>
      <SessionsTable sessions={data?.sessions ?? []} />
    </div>
  );
}
