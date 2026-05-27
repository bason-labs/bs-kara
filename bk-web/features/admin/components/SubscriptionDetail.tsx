'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useSubscriptionDetail,
  type SubscriptionDetailData,
} from '../hooks/useSubscriptionDetail';
import { useCancelSubscription } from '../hooks/useCancelSubscription';
import { lookupUserByPhone } from '@/lib/registeredUsers';
import type {
  DerivedStatus,
  SubscriptionRecord,
} from '@/lib/subscriptions/schema';

const TYPE_LABEL: Record<SubscriptionRecord['type'], string> = {
  trial: 'Dùng thử',
  paid: 'Trả phí',
};
const SOURCE_LABEL: Record<SubscriptionRecord['source'], string> = {
  manual_admin: 'Thủ công',
  self_register_phone: 'Tự đăng ký',
  payment_webhook: 'Thanh toán',
};
const DERIVED_LABEL: Record<DerivedStatus, string> = {
  active: 'Đang hoạt động',
  expired: 'Hết hạn',
  cancelled: 'Đã huỷ',
};
const DERIVED_CLASS: Record<DerivedStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  expired: 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/30',
  cancelled: 'bg-red-500/15 text-red-300 border border-red-500/30',
};

function formatDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString('vi-VN');
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 py-2 border-b border-border/40">
      <dt className="text-xs uppercase tracking-[0.16em] text-muted">{label}</dt>
      <dd className="text-sm text-fg break-all">{children}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/subscriptions"
      className="inline-flex items-center text-sm text-muted hover:text-fg"
    >
      ← Quay lại danh sách
    </Link>
  );
}

interface SubscriptionDetailViewProps {
  id: string;
  data: SubscriptionDetailData;
  refetch: () => void;
}

function SubscriptionDetailView({
  id,
  data,
  refetch,
}: SubscriptionDetailViewProps) {
  const { record, derivedStatus, daysLeft } = data;
  const router = useRouter();
  const { cancel, cancelling, error: cancelError } = useCancelSubscription();
  const [confirmingError, setConfirmingError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    lookupUserByPhone(record.userPhone)
      .then((u) => setRoomCode(u?.roomCode ?? null))
      .catch(() => setRoomCode(null));
  }, [record.userPhone]);

  const canCancel = derivedStatus === 'active';

  async function handleCancel() {
    if (!canCancel || cancelling) return;
    const ok = window.confirm(
      'Xác nhận huỷ gói đăng ký này? Hành động không thể hoàn tác.',
    );
    if (!ok) return;
    setConfirmingError(null);
    const result = await cancel(id);
    if (result.ok) {
      refetch();
      router.refresh();
      return;
    }
    setConfirmingError(result.message);
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <header>
        <h1 className="text-lg font-semibold tracking-wide">
          Chi tiết gói đăng ký
        </h1>
        <p className="mt-1 font-mono text-sm text-muted">{record.userPhone}</p>
      </header>

      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-muted">
            Trạng thái
          </span>
          <span
            className={
              'inline-flex rounded-full px-3 py-0.5 text-xs ' +
              DERIVED_CLASS[derivedStatus]
            }
          >
            {DERIVED_LABEL[derivedStatus]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-muted">
            Còn lại
          </span>
          <span className="text-sm text-fg">
            {derivedStatus === 'active' ? `${daysLeft} ngày` : '—'}
          </span>
        </div>
      </section>

      <dl className="rounded-2xl border border-border bg-surface/60 px-5 py-2">
        <Row label="ID">
          <span className="font-mono">{record.id}</span>
        </Row>
        <Row label="Số điện thoại">
          <span className="font-mono">{record.userPhone}</span>
        </Row>
        <Row label="Mã phòng">
          {roomCode === undefined ? (
            <span className="text-muted">...</span>
          ) : roomCode ? (
            <span className="font-mono font-bold">{roomCode}</span>
          ) : (
            '—'
          )}
        </Row>
        <Row label="User ID">{record.userId ?? '—'}</Row>
        <Row label="Loại">{TYPE_LABEL[record.type]}</Row>
        <Row label="Trạng thái lưu trữ">{record.status}</Row>
        <Row label="Số ngày">{`${record.durationDays} ngày`}</Row>
        <Row label="Bắt đầu">{formatDateTime(record.startDate)}</Row>
        <Row label="Kết thúc">{formatDateTime(record.endDate)}</Row>
        <Row label="Nguồn">{SOURCE_LABEL[record.source]}</Row>
        <Row label="Mã thanh toán">{record.paymentRef ?? '—'}</Row>
        <Row label="Tạo bởi">{record.createdBy ?? '—'}</Row>
        <Row label="Tạo lúc">{formatDateTime(record.createdAt)}</Row>
        <Row label="Cập nhật lúc">{formatDateTime(record.updatedAt)}</Row>
      </dl>

      {canCancel && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="px-5 py-2.5 rounded-full border border-red-500/40 bg-red-500/10 text-sm text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cancelling ? 'Đang huỷ...' : 'Huỷ gói đăng ký'}
          </button>
          {(confirmingError ?? cancelError) && (
            <p className="text-xs text-danger" role="alert">
              {confirmingError ?? cancelError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function SubscriptionDetail({ id }: { id: string }) {
  const { data, loading, error, refetch } = useSubscriptionDetail(id);

  if (loading) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-muted" role="status">
          Đang tải...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-danger" role="alert">
          {error ?? 'Không tìm thấy gói đăng ký.'}
        </p>
      </div>
    );
  }

  return <SubscriptionDetailView id={id} data={data} refetch={refetch} />;
}
