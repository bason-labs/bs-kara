'use client';

import { DataTable, type DataTableColumn } from './DataTable';
import type { RoomRow } from '@/app/api/admin/stats/route';

const COLUMNS: DataTableColumn<RoomRow>[] = [
  {
    key: 'roomId',
    label: 'Phòng',
    sortable: true,
    sortValue: (r) => r.roomId,
  },
  {
    key: 'hasTv',
    label: 'TV',
    render: (r) => (
      <span className={r.hasTv ? 'text-emerald-400' : 'text-muted'}>
        {r.hasTv ? 'Đang bật' : '—'}
      </span>
    ),
  },
  {
    key: 'queueDepth',
    label: 'Hàng chờ',
    align: 'right',
    sortable: true,
    sortValue: (r) => r.queueDepth,
  },
  {
    key: 'currentSong',
    label: 'Đang phát',
    render: (r) => (
      <span className="truncate max-w-[240px] block text-muted">
        {r.currentSong ?? '—'}
      </span>
    ),
  },
  {
    key: 'lastEndedAt',
    label: 'Kết thúc lần cuối',
    render: (r) =>
      r.lastEndedAt
        ? new Date(r.lastEndedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        : '—',
  },
];

interface RoomsTableProps {
  rooms: RoomRow[];
}

export function RoomsTable({ rooms }: RoomsTableProps) {
  return (
    <DataTable
      columns={COLUMNS}
      data={rooms}
      defaultSortKey="roomId"
      defaultSortDir="asc"
      rowKey={(r) => r.roomId}
      emptyMessage="Không có phòng nào đang hoạt động."
    />
  );
}
