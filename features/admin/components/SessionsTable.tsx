'use client';

import { DataTable, type DataTableColumn } from './DataTable';
import type { SessionRecord } from '@/app/api/admin/sessions/route';

function formatDuration(joinedAt: number, leftAt: number | null): string {
  if (!leftAt) return 'Đang hoạt động';
  const secs = Math.round((leftAt - joinedAt) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

const COLUMNS: DataTableColumn<SessionRecord>[] = [
  {
    key: 'deviceType',
    label: 'Thiết bị',
    render: (r) => (
      <span className={r.deviceType === 'mobile' ? 'text-emerald-400' : 'text-muted'}>
        {r.deviceType === 'mobile' ? 'Điện thoại' : 'Máy tính'}
      </span>
    ),
  },
  {
    key: 'roomId',
    label: 'Phòng',
    sortable: true,
    sortValue: (r) => r.roomId,
  },
  {
    key: 'ip',
    label: 'IP',
    render: (r) => <span className="font-mono text-xs">{r.ip}</span>,
  },
  {
    key: 'joinedAt',
    label: 'Tham gia',
    sortable: true,
    sortValue: (r) => r.joinedAt,
    render: (r) =>
      new Date(r.joinedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
  },
  {
    key: 'duration',
    label: 'Thời lượng',
    render: (r) => formatDuration(r.joinedAt, r.leftAt),
  },
];

interface SessionsTableProps {
  sessions: SessionRecord[];
}

export function SessionsTable({ sessions }: SessionsTableProps) {
  return (
    <DataTable
      columns={COLUMNS}
      data={sessions}
      defaultSortKey="joinedAt"
      defaultSortDir="desc"
      rowKey={(r) => r.sessionId}
      emptyMessage="Chưa có phiên nào được ghi nhận."
    />
  );
}
