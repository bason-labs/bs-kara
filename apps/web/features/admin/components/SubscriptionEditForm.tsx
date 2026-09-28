'use client';

import { FormEvent, useState } from 'react';
import type { SubscriptionRecord, SubscriptionStatus } from '@/lib/subscriptions/schema';
import type { SubscriptionActionOutcome } from '../hooks/useSubscriptionActions';
import type { UpdateSubscriptionInput } from '@/lib/subscriptions/schema';
import { DatePicker, Stepper, dateInputToEpochMs } from './SubscriptionForm';

interface SubscriptionEditFormProps {
  record: SubscriptionRecord;
  busy: boolean;
  onSave: (changes: UpdateSubscriptionInput) => Promise<SubscriptionActionOutcome>;
  onDone: () => void;
}

const LABEL = 'text-[9px] uppercase tracking-[0.18em] text-muted font-medium';
const INPUT = 'w-full px-4 py-2.5 rounded-xl border border-border bg-bg/40 text-fg outline-none focus:border-fg/40';

// Start dates are stored as UTC midnight (dateInputToEpochMs), so the UTC
// calendar day is the day the admin picked.
function epochMsToDateInput(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// Edit an existing subscription. Phone and type are shown but locked: to
// change them, delete and create a new one.
export function SubscriptionEditForm({ record, busy, onSave, onDone }: SubscriptionEditFormProps) {
  const [status, setStatus] = useState<SubscriptionStatus>(record.status);
  const [durationDays, setDurationDays] = useState(String(record.durationDays));
  const [startDate, setStartDate] = useState(epochMsToDateInput(record.startDate));
  const [paymentRef, setPaymentRef] = useState(record.paymentRef ?? '');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await onSave({
      status,
      durationDays: Number(durationDays),
      startDate: dateInputToEpochMs(startDate),
      ...(record.type === 'paid' ? { paymentRef: paymentRef.trim() } : {}),
    });
    if (result.ok) onDone();
    else setError(result.message);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl flex flex-col gap-5 rounded-2xl border border-border bg-surface/60 px-5 py-5">
      <p className="text-xs text-muted">
        Số điện thoại và loại gói không sửa được — hãy xoá và tạo gói mới.
      </p>

      <div className="flex flex-col gap-1.5 text-sm">
        <span className={LABEL}>Trạng thái</span>
        <div className="flex w-full rounded-lg border border-border bg-bg/40 p-0.5 text-xs">
          {(['active', 'cancelled'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setStatus(opt)}
              aria-pressed={status === opt}
              className={'flex-1 text-center py-2 rounded-full transition-colors ' + (status === opt ? 'bg-bg text-fg' : 'text-muted hover:text-fg')}
            >
              {opt === 'active' ? 'Hoạt động' : 'Đã huỷ'}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className={LABEL}>Ngày bắt đầu</span>
        <DatePicker value={startDate} onChange={setStartDate} />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className={LABEL}>Số ngày</span>
        <Stepper value={durationDays} onChange={setDurationDays} min={1} max={365} label="Số ngày" />
      </label>

      {record.type === 'paid' && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className={LABEL}>Mã thanh toán</span>
          <input type="text" maxLength={128} autoComplete="off" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} className={INPUT} />
        </label>
      )}

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-gradient-brand rounded-lg px-4 py-2.5 text-sm font-semibold text-fg shadow-glow disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {busy ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted hover:text-fg transition-colors">
          Huỷ
        </button>
      </div>
    </form>
  );
}
