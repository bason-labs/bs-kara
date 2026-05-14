'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DataTable,
  type DataTableColumn,
} from './DataTable';
import { derive, daysLeft } from '@/lib/subscriptions/expiry';
import { DAY_MS, type SubscriptionRecord } from '@/lib/subscriptions/schema';

type TypeFilter = 'all' | 'trial' | 'paid';
type StatusFilter = 'all' | 'active' | 'expired' | 'cancelled';
type SourceFilter =
  | 'all'
  | 'manual_admin'
  | 'self_register_phone'
  | 'payment_webhook';

export interface SubscriptionFilters {
  type: TypeFilter;
  status: StatusFilter;
  source: SourceFilter;
  expiringSoon: boolean;
}

const EXPIRING_SOON_WINDOW_MS = 7 * DAY_MS;

// Pure filter function — extracted so it can be unit-tested independently
// of the React component. AND semantics across all four filters.
export function filterSubscriptions(
  data: SubscriptionRecord[],
  filters: SubscriptionFilters,
  now: number,
): SubscriptionRecord[] {
  return data.filter((rec) => {
    if (filters.type !== 'all' && rec.type !== filters.type) return false;
    if (filters.source !== 'all' && rec.source !== filters.source) return false;
    const derived = derive(rec, now);
    if (filters.status !== 'all' && derived !== filters.status) return false;
    if (filters.expiringSoon) {
      if (derived !== 'active') return false;
      if (rec.endDate - now >= EXPIRING_SOON_WINDOW_MS) return false;
    }
    return true;
  });
}

const TYPE_LABEL: Record<SubscriptionRecord['type'], string> = {
  trial: 'Dùng thử',
  paid: 'Trả phí',
};

const SOURCE_LABEL: Record<SubscriptionRecord['source'], string> = {
  manual_admin: 'Thủ công',
  self_register_phone: 'Tự đăng ký',
  payment_webhook: 'Thanh toán',
};

const STATUS_LABEL: Record<'active' | 'expired' | 'cancelled', string> = {
  active: 'Đang hoạt động',
  expired: 'Hết hạn',
  cancelled: 'Đã huỷ',
};

const TYPE_CLASS: Record<SubscriptionRecord['type'], string> = {
  trial: 'bg-[rgba(0,139,139,0.15)] border-[rgba(0,139,139,0.4)] text-accent',
  paid:  'bg-surface/40 border-border text-muted',
};

const STATUS_CLASS: Record<'active' | 'expired' | 'cancelled', string> = {
  active:    'bg-[rgba(34,197,94,0.13)] border-[rgba(34,197,94,0.35)] text-[#4ade80]',
  expired:   'bg-[rgba(255,95,109,0.11)] border-[rgba(255,95,109,0.35)] text-danger',
  cancelled: 'bg-[rgba(249,115,22,0.12)] border-[rgba(249,115,22,0.35)] text-[#fb923c]',
};

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('vi-VN');
}

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="inline-flex rounded-full border border-border bg-bg/40 p-0.5 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={
            'px-3 py-1.5 rounded-full transition-colors ' +
            (value === opt.value
              ? 'bg-bg text-fg'
              : 'text-muted hover:text-fg')
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export interface SubscriptionsTableProps {
  data: SubscriptionRecord[];
  // Injected for deterministic tests. Defaults to Date.now() in the
  // container; the component itself doesn't sample the clock.
  now: number;
}

export function SubscriptionsTable({ data, now }: SubscriptionsTableProps) {
  const [filters, setFilters] = useState<SubscriptionFilters>({
    type: 'all',
    status: 'all',
    source: 'all',
    expiringSoon: false,
  });

  const filtered = useMemo(
    () => filterSubscriptions(data, filters, now),
    [data, filters, now],
  );

  const columns: DataTableColumn<SubscriptionRecord>[] = [
    {
      key: 'userPhone',
      label: 'Số điện thoại',
      render: (row) => (
        <Link
          href={`/admin/subscriptions/${row.id}`}
          className="text-fg hover:underline"
        >
          {row.userPhone}
        </Link>
      ),
    },
    {
      key: 'type',
      label: 'Loại',
      render: (row) => (
        <span
          className={
            'inline-flex rounded-full border px-2.5 py-0.5 text-[8.5px] font-medium ' +
            TYPE_CLASS[row.type]
          }
        >
          {TYPE_LABEL[row.type]}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => {
        const d = derive(row, now);
        return (
          <span
            className={
              'inline-flex rounded-full border px-2.5 py-0.5 text-[8.5px] font-medium ' +
              STATUS_CLASS[d]
            }
          >
            {STATUS_LABEL[d]}
          </span>
        );
      },
    },
    {
      key: 'startDate',
      label: 'Bắt đầu',
      render: (row) => formatDate(row.startDate),
    },
    {
      key: 'endDate',
      label: 'Kết thúc',
      render: (row) => formatDate(row.endDate),
    },
    {
      key: 'daysLeft',
      label: 'Còn lại',
      sortable: true,
      // Sort by endDate (not daysLeft) so cancelled rows interleave by
      // their endDate too. Soonest-to-expire = smallest endDate.
      sortValue: (row) => row.endDate,
      render: (row) => `${daysLeft(row, now)} ngày`,
    },
    {
      key: 'source',
      label: 'Nguồn',
      render: (row) => SOURCE_LABEL[row.source],
    },
    {
      key: 'createdBy',
      label: 'Tạo bởi',
      render: (row) => row.createdBy ?? '—',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href="/admin/subscriptions/new"
          className="px-4 py-2 rounded-full bg-gradient-brand text-white text-sm font-medium tracking-wide shadow-glow transition-transform active:scale-[0.98]"
        >
          Thêm gói mới
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<TypeFilter>
          value={filters.type}
          onChange={(type) => setFilters((f) => ({ ...f, type }))}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'trial', label: 'Dùng thử' },
            { value: 'paid', label: 'Trả phí' },
          ]}
        />
        <Segmented<StatusFilter>
          value={filters.status}
          onChange={(status) => setFilters((f) => ({ ...f, status }))}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'active', label: 'Đang hoạt động' },
            { value: 'expired', label: 'Hết hạn' },
            { value: 'cancelled', label: 'Đã huỷ' },
          ]}
        />
        <Segmented<SourceFilter>
          value={filters.source}
          onChange={(source) => setFilters((f) => ({ ...f, source }))}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'manual_admin', label: 'Thủ công' },
            { value: 'self_register_phone', label: 'Tự đăng ký' },
            { value: 'payment_webhook', label: 'Thanh toán' },
          ]}
        />
        <button
          type="button"
          onClick={() =>
            setFilters((f) => ({ ...f, expiringSoon: !f.expiringSoon }))
          }
          className={
            'px-3 py-1.5 rounded-full border text-xs transition-colors ' +
            (filters.expiringSoon
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
              : 'border-border bg-bg/40 text-muted hover:text-fg')
          }
          aria-pressed={filters.expiringSoon}
        >
          Sắp hết hạn
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(row) => row.id}
        defaultSortKey="daysLeft"
        defaultSortDir="asc"
        emptyMessage="Chưa có gói đăng ký nào"
      />
    </div>
  );
}
