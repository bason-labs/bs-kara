# Subscription Form UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native browser date picker and number input in the Add Subscription form with custom dark-themed React components (custom calendar popup + stepper), and fix field spacing, toggle width, and button sizing to match the admin glassmorphism design system.

**Architecture:** All changes are confined to `features/admin/components/SubscriptionForm.tsx` (two new inline components + two exported pure helpers + render updates) and `app/admin/(gated)/subscriptions/new/page.tsx` (header class fix). No new files, no new libraries — Lucide React icons already installed.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, Lucide React `^1.11.0`

---

## File Map

| File | Role |
|---|---|
| `features/admin/components/SubscriptionForm.tsx` | Add `buildCalendarDays`, `formatDisplay` exports; add `Stepper`, `DatePicker` inline components; update form render |
| `features/admin/components/SubscriptionForm.helpers.test.ts` | Unit tests for the two pure helper functions |
| `app/admin/(gated)/subscriptions/new/page.tsx` | Fix `h1` classes (`font-semibold tracking-wide` → `font-bold text-fg`) |

---

## Task 1: Pure helpers — `buildCalendarDays` and `formatDisplay`

**Files:**
- Modify: `features/admin/components/SubscriptionForm.tsx` (add two named exports near the top, after `dateInputToEpochMs`)
- Create: `features/admin/components/SubscriptionForm.helpers.test.ts`

These are pure functions with real logic (month boundary arithmetic) — they need tests before use.

- [ ] **Step 1: Write the failing tests**

Create `features/admin/components/SubscriptionForm.helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildCalendarDays, formatDisplay } from './SubscriptionForm';

describe('buildCalendarDays', () => {
  it('returns exactly 42 cells', () => {
    // May 2026 (month index 4)
    expect(buildCalendarDays(2026, 4).length).toBe(42);
  });

  it('starts on the Monday of the week containing the 1st', () => {
    // May 1 2026 is a Friday → week starts Mon Apr 27
    const cells = buildCalendarDays(2026, 4);
    expect(cells[0].date.getDate()).toBe(27);
    expect(cells[0].date.getMonth()).toBe(3); // April = 3
  });

  it('marks days outside the viewed month as currentMonth: false', () => {
    const cells = buildCalendarDays(2026, 4); // May 2026
    expect(cells[0].currentMonth).toBe(false); // Apr 27
    expect(cells[4].currentMonth).toBe(true);  // May 1
  });

  it('handles a month starting on Monday (zero leading days)', () => {
    // June 1 2026 is a Monday
    const cells = buildCalendarDays(2026, 5);
    expect(cells[0].date.getDate()).toBe(1);
    expect(cells[0].date.getMonth()).toBe(5); // June = 5
    expect(cells[0].currentMonth).toBe(true);
  });

  it('handles February in a leap year (29 days)', () => {
    // Feb 2028 is a leap year: 29 days in month
    const cells = buildCalendarDays(2028, 1);
    expect(cells.length).toBe(42);
    expect(cells.filter((c) => c.currentMonth).length).toBe(29);
  });
});

describe('formatDisplay', () => {
  it('formats YYYY-MM-DD as dd/MM/yyyy', () => {
    expect(formatDisplay('2026-05-15')).toBe('15/05/2026');
  });

  it('returns empty string for empty input', () => {
    expect(formatDisplay('')).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --run features/admin/components/SubscriptionForm.helpers.test.ts
```

Expected: FAIL — `buildCalendarDays` and `formatDisplay` are not exported yet.

- [ ] **Step 3: Add the two helper exports to `SubscriptionForm.tsx`**

Open `features/admin/components/SubscriptionForm.tsx`. After the existing `dateInputToEpochMs` function (currently around line 42), add:

```ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- --run features/admin/components/SubscriptionForm.helpers.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "SubscriptionForm|helpers"
```

Expected: no output (no errors in those files).

- [ ] **Step 6: Commit**

```bash
git add features/admin/components/SubscriptionForm.tsx features/admin/components/SubscriptionForm.helpers.test.ts
git commit -m "feat(admin): add buildCalendarDays and formatDisplay helpers with tests"
```

---

## Task 2: `Stepper` component

**Files:**
- Modify: `features/admin/components/SubscriptionForm.tsx` (add `Stepper` function before `SubscriptionForm`; replace the `<input type="number">` in the form render)

- [ ] **Step 1: Add the `Stepper` component**

In `SubscriptionForm.tsx`, directly before the `InlineError` function, add:

```tsx
interface StepperProps {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
}

function Stepper({ value, onChange, min = 1, max = 365 }: StepperProps) {
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
```

- [ ] **Step 2: Replace `<input type="number">` with `<Stepper>` in the form render**

Find this block (around line 199):

```tsx
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
```

Replace with:

```tsx
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[9px] uppercase tracking-[0.18em] text-muted font-medium">
          Số ngày
        </span>
        <Stepper value={durationDays} onChange={setDurationDays} min={1} max={365} />
        <InlineError message={errFor('durationDays')} />
      </label>
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "SubscriptionForm"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add features/admin/components/SubscriptionForm.tsx
git commit -m "feat(admin): replace number input with Stepper component"
```

---

## Task 3: `DatePicker` component

**Files:**
- Modify: `features/admin/components/SubscriptionForm.tsx` (add `useRef` to React import; add `Calendar, ChevronLeft, ChevronRight` from lucide-react; add `DatePicker` function; replace `<input type="date">` in form render)

- [ ] **Step 1: Update imports at the top of `SubscriptionForm.tsx`**

The current line 1–3 imports are:
```tsx
'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
```

Replace the React import line with:
```tsx
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
```

Add after the `next/navigation` import:
```tsx
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
```

- [ ] **Step 2: Add the `DatePicker` component**

Add directly before the `Stepper` function (inserted in Task 2):

```tsx
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
          {/* Month nav header */}
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

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {['T2','T3','T4','T5','T6','T7','CN'].map((h) => (
              <div key={h} className="text-[8px] text-muted text-center py-0.5 font-semibold">
                {h}
              </div>
            ))}
          </div>

          {/* Day cells */}
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
```

- [ ] **Step 3: Replace `<input type="date">` with `<DatePicker>` in the form render**

Find this block (around line 233):

```tsx
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
```

Replace with:

```tsx
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[9px] uppercase tracking-[0.18em] text-muted font-medium">
          Ngày bắt đầu
        </span>
        <DatePicker value={startDate} onChange={setStartDate} />
        <InlineError message={errFor('startDate')} />
      </label>
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "SubscriptionForm"
```

Expected: no output.

- [ ] **Step 5: Run all tests to confirm nothing broke**

```bash
npm run test -- --run
```

Expected: all pass, 7 new helpers tests still green.

- [ ] **Step 6: Commit**

```bash
git add features/admin/components/SubscriptionForm.tsx
git commit -m "feat(admin): replace date input with custom DatePicker component"
```

---

## Task 4: Form polish — toggle width, label spacing, button row, page header

**Files:**
- Modify: `features/admin/components/SubscriptionForm.tsx` (toggle, form gap, phone/paymentRef labels, button row; add `Link` import)
- Modify: `app/admin/(gated)/subscriptions/new/page.tsx` (h1 class)

- [ ] **Step 1: Add `Link` import to `SubscriptionForm.tsx`**

After the `next/navigation` import, add:

```tsx
import Link from 'next/link';
```

- [ ] **Step 2: Fix form outer `gap` and phone field label**

Find:
```tsx
    <form onSubmit={handleSubmit} className="w-full max-w-xl flex flex-col gap-5">
```
Replace with:
```tsx
    <form onSubmit={handleSubmit} className="w-full max-w-xl flex flex-col gap-6">
```

Find the phone label block:
```tsx
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">
          Số điện thoại
        </span>
```
Replace with:
```tsx
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[9px] uppercase tracking-[0.18em] text-muted font-medium">
          Số điện thoại
        </span>
```

- [ ] **Step 3: Fix toggle group (width + shape)**

Find:
```tsx
        <div className="inline-flex rounded-full border border-border bg-bg/40 p-0.5 text-xs">
```
Replace with:
```tsx
        <div className="inline-flex self-start rounded-lg border border-border bg-bg/40 p-0.5 text-xs">
```

Also fix the fieldset legend label:
```tsx
        <legend className="text-xs uppercase tracking-[0.2em] text-muted">
```
Replace with:
```tsx
        <legend className="text-[9px] uppercase tracking-[0.18em] text-muted font-medium">
```

- [ ] **Step 4: Fix paymentRef label (shown only for paid type)**

Find:
```tsx
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Mã thanh toán
          </span>
```
Replace with:
```tsx
          <span className="text-[9px] uppercase tracking-[0.18em] text-muted font-medium">
            Mã thanh toán
          </span>
```

Also update `gap-2` → `gap-1.5` on the paymentRef label wrapper:
```tsx
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Mã thanh toán
```
Replace outer class:
```tsx
        <label className="flex flex-col gap-1.5 text-sm">
```

- [ ] **Step 5: Replace submit button with compact button + cancel link**

Find:
```tsx
      <button
        type="submit"
        disabled={submitting}
        className="self-start px-6 py-3 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {submitting ? 'Đang tạo...' : 'Tạo gói đăng ký'}
      </button>
```

Replace with:
```tsx
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="bg-gradient-brand rounded-lg px-4 py-2.5 text-sm font-semibold text-fg shadow-glow disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {submitting ? 'Đang tạo...' : 'Tạo gói đăng ký'}
        </button>
        <Link
          href="/admin/subscriptions"
          className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted hover:text-fg transition-colors"
        >
          Huỷ
        </Link>
      </div>
```

- [ ] **Step 6: Fix page header in `new/page.tsx`**

Open `app/admin/(gated)/subscriptions/new/page.tsx`. Find:
```tsx
        <h1 className="text-lg font-semibold tracking-wide">
          Thêm gói đăng ký mới
        </h1>
```
Replace with:
```tsx
        <h1 className="text-lg font-bold text-fg">
          Thêm gói đăng ký mới
        </h1>
```

- [ ] **Step 7: Typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | grep -E "SubscriptionForm|new/page"
npm run lint 2>&1 | grep -E "SubscriptionForm|new/page"
```

Expected: no errors in those files.

- [ ] **Step 8: Run full test suite**

```bash
npm run test -- --run
```

Expected: all pass.

- [ ] **Step 9: Visual check**

```bash
npm run dev
```

Navigate to `http://localhost:3000/admin/subscriptions/new` and verify:
- "Loại gói" toggle is width-fit (not full-width), rounded corners (not pill)
- "Số ngày" shows `−` / `14` / `+` stepper, clamped at 1 (try clicking −) and 365 (type 999, blur)
- "Ngày bắt đầu" shows `dd/MM/yyyy` format + calendar icon; clicking opens dark popup; selecting a day updates the display and closes the popup; clicking outside also closes
- Submit button is compact and sits next to a "Huỷ" link
- "Huỷ" navigates back to `/admin/subscriptions`
- All labels are consistent: `text-[9px] uppercase tracking-[0.18em] text-muted font-medium`

- [ ] **Step 10: Commit**

```bash
git add features/admin/components/SubscriptionForm.tsx app/admin/\(gated\)/subscriptions/new/page.tsx
git commit -m "feat(admin): polish subscription form — toggle width, label spacing, compact button row"
```

---

## Self-Review

**Spec coverage:**
- ✅ Section 2 (tokens) — all RGBA values, `bg-[#071212]`, `border-border`, `text-accent` used exactly as specified
- ✅ Section 3 (DatePicker) — `buildCalendarDays`, `formatDisplay`, click-outside via `mousedown`, Lucide icons, Vietnamese headers T2–CN, selected day style with `color:#7df9ff`
- ✅ Section 4 (Stepper) — `inline-flex`, `min-w-[140px]`, `w-fit`, `self-start`, disabled states, blur clamp
- ✅ Section 5 (Button row) — `rounded-lg px-4 py-2.5`, Cancel `Link`
- ✅ Section 6 (Field structure) — `gap-6` form, `gap-1.5` label-to-control, `self-start` on toggle, `rounded-lg` toggle shape
- ✅ Section 7 (Page header) — `font-bold text-fg`
- ✅ Section 8 (unchanged) — validation, submission, `dateInputToEpochMs`, `InlineError`, `toE164VN`, all untouched

**Placeholder scan:** No TBDs. All code blocks are complete.

**Type consistency:** `DatePickerProps.value: string`, `StepperProps.value: string` — both use `string` throughout. `buildCalendarDays` return type `{ date: Date; currentMonth: boolean }[]` matches usage in `DatePicker`. `formatDisplay(string): string` used in `DatePicker` display button. All consistent.
