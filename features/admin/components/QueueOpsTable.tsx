'use client';

import { DataTable, type DataTableColumn } from './DataTable';
import type { RoomQueueOps } from '@/app/api/admin/queue-ops/route';

const COLUMNS: DataTableColumn<RoomQueueOps>[] = [
  {
    key: 'roomId',
    label: 'Phòng',
    sortable: true,
    sortValue: (r) => r.roomId,
  },
  {
    key: 'adds',
    label: 'Thêm vào',
    align: 'right',
    sortable: true,
    sortValue: (r) => r.adds,
  },
  {
    key: 'removes',
    label: 'Xóa',
    align: 'right',
    sortable: true,
    sortValue: (r) => r.removes,
  },
  {
    key: 'net',
    label: 'Thực tế',
    align: 'right',
    sortable: true,
    sortValue: (r) => r.adds - r.removes,
    render: (r) => String(r.adds - r.removes),
  },
];

interface QueueOpsTableProps {
  rooms: RoomQueueOps[];
}

export function QueueOpsTable({ rooms }: QueueOpsTableProps) {
  return (
    <DataTable
      columns={COLUMNS}
      data={rooms}
      defaultSortKey="adds"
      defaultSortDir="desc"
      rowKey={(r) => r.roomId}
      emptyMessage="Chưa có thao tác hàng chờ nào được ghi nhận."
    />
  );
}
