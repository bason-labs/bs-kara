'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useCreateSubscription,
  type CreateSubscriptionFormInput,
} from '../hooks/useCreateSubscription';
import { toE164VN } from '@/lib/subscriptions/phone';

type SubscriptionType = 'trial' | 'paid';

// Trial duration default. NEXT_PUBLIC_ prefix because this is read in a
// client component. The value is a DEFAULT only — admins can override per
// entry. Future self-register flows may also use this as a cap, but the
// manual-add form does not cap.
function getTrialDefaultDays(): number {
  const raw = process.env.NEXT_PUBLIC_ADMIN_TRIAL_DEFAULT_DAYS;
  const n = raw ? Number(raw) : NaN;
  if (Number.isInteger(n) && n >= 1 && n <= 365) return n;
  return 14;
}

// Format a Date as 'YYYY-MM-DD' for an <input type="date">. We intentionally
// use the LOCAL date (not UTC), so an admin in Vietnam picking "today"
// gets the Vietnamese calendar day.
function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Convert 'YYYY-MM-DD' to epoch ms. new Date('YYYY-MM-DD') parses as UTC
// midnight, which becomes 07:00 in Vietnam (UTC+7). That's an acceptable
// interpretation of "the day the subscription begins": a date is not an
// instant, and any choice has the same trade-off. Documented here so a
// future reader doesn't "fix" it.
function dateInputToEpochMs(value: string): number {
  return new Date(value + 'T00:00:00Z').getTime();
}

interface InlineErrorProps {
  message: string | undefined;
}
function InlineError({ message }: InlineErrorProps) {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs text-danger" role="alert">
      {message}
    </p>
  );
}

export function SubscriptionForm() {
  const router = useRouter();
  const { submit, submitting, error, fieldErrors } = useCreateSubscription();

  const trialDefault = useMemo(() => getTrialDefaultDays(), []);
  const [type, setType] = useState<SubscriptionType>('trial');
  const [userPhone, setUserPhone] = useState('');
  const [phoneNormalised, setPhoneNormalised] = useState<string | null>(null);
  const [durationDays, setDurationDays] = useState<string>(
    String(trialDefault),
  );
  const [paymentRef, setPaymentRef] = useState('');
  const [startDate, setStartDate] = useState<string>(todayLocalISO());
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  function handleTypeChange(next: SubscriptionType) {
    setType(next);
    if (next === 'trial') {
      setPaymentRef('');
      setDurationDays(String(trialDefault));
    } else {
      // Clear the trial-default so the admin enters a paid duration explicitly.
      setDurationDays('');
    }
    setLocalErrors({});
  }

  function handlePhoneBlur() {
    const norm = toE164VN(userPhone);
    setPhoneNormalised(norm);
  }

  function validateLocal(): Record<string, string> {
    const errs: Record<string, string> = {};
    const norm = toE164VN(userPhone);
    if (!norm) {
      errs.userPhone = 'Số điện thoại không hợp lệ. Định dạng: 0XXXXXXXXX';
    }
    const dd = Number(durationDays);
    if (!Number.isInteger(dd) || dd < 1 || dd > 365) {
      errs.durationDays = 'Số ngày phải từ 1 đến 365.';
    }
    if (type === 'paid' && paymentRef.trim().length === 0) {
      errs.paymentRef = 'Mã thanh toán là bắt buộc với gói trả phí.';
    }
    if (type === 'paid' && paymentRef.length > 128) {
      errs.paymentRef = 'Mã thanh toán quá dài (tối đa 128 ký tự).';
    }
    if (!startDate) {
      errs.startDate = 'Vui lòng chọn ngày bắt đầu.';
    }
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const errs = validateLocal();
    setLocalErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload: CreateSubscriptionFormInput = {
      userPhone,
      type,
      durationDays: Number(durationDays),
      paymentRef: type === 'paid' ? paymentRef.trim() : '',
      startDate: dateInputToEpochMs(startDate),
    };

    const outcome = await submit(payload);
    if (outcome.ok) {
      router.push('/admin/subscriptions');
      router.refresh();
    }
    // On failure the hook has already populated error/fieldErrors. The
    // render below picks them up — nothing else to do here.
  }

  // Server-returned field errors take precedence over local ones (the
  // server is authoritative). Fall back to local when the server didn't
  // flag that field.
  const errFor = (k: string): string | undefined =>
    fieldErrors[k] ?? localErrors[k];

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl flex flex-col gap-5">
      {error && (
        <p
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">
          Số điện thoại
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0901234567"
          value={userPhone}
          onChange={(e) => setUserPhone(e.target.value)}
          onBlur={handlePhoneBlur}
          required
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg/40 text-fg outline-none focus:border-fg/40"
        />
        {phoneNormalised && (
          <span className="text-xs text-muted">
            Lưu trữ: {phoneNormalised}
          </span>
        )}
        <InlineError message={errFor('userPhone')} />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="text-xs uppercase tracking-[0.2em] text-muted">
          Loại gói
        </legend>
        <div className="inline-flex rounded-full border border-border bg-bg/40 p-0.5 text-xs w-fit">
          {(['trial', 'paid'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleTypeChange(opt)}
              className={
                'px-4 py-1.5 rounded-full transition-colors ' +
                (type === opt
                  ? 'bg-bg text-fg'
                  : 'text-muted hover:text-fg')
              }
              aria-pressed={type === opt}
            >
              {opt === 'trial' ? 'Dùng thử' : 'Trả phí'}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">
          Số ngày
        </span>
        <input
          type="number"
          min={1}
          max={365}
          step={1}
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value)}
          required
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg/40 text-fg outline-none focus:border-fg/40"
        />
        <InlineError message={errFor('durationDays')} />
      </label>

      {type === 'paid' && (
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Mã thanh toán
          </span>
          <input
            type="text"
            maxLength={128}
            autoComplete="off"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg/40 text-fg outline-none focus:border-fg/40"
          />
          <InlineError message={errFor('paymentRef')} />
        </label>
      )}

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">
          Ngày bắt đầu
        </span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg/40 text-fg outline-none focus:border-fg/40"
        />
        <InlineError message={errFor('startDate')} />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="self-start px-6 py-3 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {submitting ? 'Đang tạo...' : 'Tạo gói đăng ký'}
      </button>
    </form>
  );
}
