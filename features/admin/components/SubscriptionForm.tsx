'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
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

// Returns a 42-cell (6-week) Monday-first grid for the given month.
// month is 0-indexed (JS convention). Pure — safe to unit-test.
export function buildCalendarDays(
  year: number,
  month: number,
): { date: Date; currentMonth: boolean }[] {
  const firstOfMonth = new Date(year, month, 1);
  const dow = firstOfMonth.getDay(); // 0=Sun … 6=Sat
  // Monday-first offset: Mon→0, Tue→1 … Sun→6
  const startOffset = dow === 0 ? 6 : dow - 1;
  const startDate = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + i,
    );
    return { date, currentMonth: date.getMonth() === month };
  });
}

// Converts 'YYYY-MM-DD' → 'dd/MM/yyyy' for display. Pure.
export function formatDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

interface DatePickerProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (v: string) => void;
}

function DatePicker({ value, onChange }: DatePickerProps) {
  const parsed = value ? new Date(value + 'T00:00:00') : new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }
  function selectDay(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setOpen(false);
  }

  const MONTH_NAMES = [
    'Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
    'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12',
  ];
  const days = buildCalendarDays(viewYear, viewMonth);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          'w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm text-fg bg-white/[0.04] transition-colors ' +
          (open ? 'border-[rgba(0,139,139,0.45)]' : 'border-border')
        }
      >
        <span>{formatDisplay(value) || 'Chọn ngày'}</span>
        <Calendar size={14} className="text-muted flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-[#071212] border border-border rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] p-4 w-60">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-md text-muted hover:bg-[rgba(0,139,139,0.12)] hover:text-accent transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-semibold text-fg">
              {MONTH_NAMES[viewMonth]} · {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-md text-muted hover:bg-[rgba(0,139,139,0.12)] hover:text-accent transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {['T2','T3','T4','T5','T6','T7','CN'].map((h) => (
              <div key={h} className="text-[8px] text-muted text-center py-0.5 font-semibold">
                {h}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map(({ date, currentMonth }, i) => {
              const iso =
                `${date.getFullYear()}-` +
                `${String(date.getMonth() + 1).padStart(2, '0')}-` +
                `${String(date.getDate()).padStart(2, '0')}`;
              const selected = iso === value;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => currentMonth && selectDay(date)}
                  className={
                    'text-[11px] py-1.5 rounded-md text-center transition-colors ' +
                    (selected
                      ? 'font-bold border border-[rgba(0,139,139,0.5)] bg-[rgba(0,139,139,0.3)]'
                      : currentMonth
                        ? 'text-muted hover:bg-[rgba(0,139,139,0.12)] hover:text-fg cursor-pointer'
                        : 'text-muted/20 cursor-default')
                  }
                  style={selected ? { color: '#7df9ff' } : undefined}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface StepperProps {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  label?: string;
}

function Stepper({ value, onChange, min = 1, max = 365, label }: StepperProps) {
  const n = parseInt(value, 10);
  const atMin = isNaN(n) || n <= min;
  const atMax = !isNaN(n) && n >= max;

  function dec() {
    onChange(String(isNaN(n) ? min : Math.max(min, n - 1)));
  }
  function inc() {
    onChange(String(isNaN(n) ? min : Math.min(max, n + 1)));
  }
  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const parsed = parseInt(e.target.value, 10);
    onChange(String(isNaN(parsed) ? min : Math.min(max, Math.max(min, parsed))));
  }

  return (
    <div className="inline-flex items-center border border-border rounded-xl overflow-hidden bg-white/[0.04] min-w-[140px] w-fit self-start">
      <button
        type="button"
        onClick={dec}
        disabled={atMin}
        aria-label="Giảm"
        className="w-[38px] h-[38px] flex items-center justify-center text-muted hover:bg-[rgba(0,139,139,0.12)] hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        −
      </button>
      <div className="w-px h-5 bg-border flex-shrink-0" />
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        aria-label={label}
        className="flex-1 text-center bg-transparent text-fg text-sm outline-none py-2.5 min-w-[40px]"
      />
      <div className="w-px h-5 bg-border flex-shrink-0" />
      <button
        type="button"
        onClick={inc}
        disabled={atMax}
        aria-label="Tăng"
        className="w-[38px] h-[38px] flex items-center justify-center text-muted hover:bg-[rgba(0,139,139,0.12)] hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  );
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

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[9px] uppercase tracking-[0.18em] text-muted font-medium">
          Số ngày
        </span>
        <Stepper value={durationDays} onChange={setDurationDays} min={1} max={365} label="Số ngày" />
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

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[9px] uppercase tracking-[0.18em] text-muted font-medium">
          Ngày bắt đầu
        </span>
        <DatePicker value={startDate} onChange={setStartDate} />
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
