'use client';

import { useAdminData } from '../context/AdminDataContext';
import { SessionsTable } from './SessionsTable';

export function SessionsShell() {
  const { sessions: { data, loading, error } } = useAdminData();

  if (loading) {
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
