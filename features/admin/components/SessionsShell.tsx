'use client';

import { useAdminData } from '../context/AdminDataContext';
import { SessionsTable } from './SessionsTable';

export function SessionsShell() {
  const { sessions: { data, loading, error } } = useAdminData();

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse" role="status" aria-label="Đang tải…">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-5 bg-border/60 rounded"
            style={{ width: `${55 + i * 9}%` }}
          />
        ))}
      </div>
    );
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
