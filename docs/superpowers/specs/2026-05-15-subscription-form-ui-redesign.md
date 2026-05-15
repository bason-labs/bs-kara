# Subscription Form UI Redesign — Design Spec

## Goal

Replace the native browser date picker and number input in `/admin/subscriptions/new` with custom dark-themed components that match the existing glassmorphism design system. Fix label spacing and button sizing to be consistent with the rest of the admin UI.

## Approved Design

Option A: Custom calendar popup + stepper. No new libraries. No changes to validation logic, form state, or submission flow.

---

## 1. Files Changed

| File | Change |
|---|---|
| `features/admin/components/SubscriptionForm.tsx` | Replace `<input type="date">` with `DatePicker`; replace `<input type="number">` with `Stepper`; fix submit/cancel buttons |
| `app/admin/(gated)/subscriptions/new/page.tsx` | Update page header to `font-bold text-fg` (match standardized style) |

No new files. No new dependencies.

---

## 2. Color & Token System

Same tokens used by the rest of the admin UI — no new CSS variables.

| Usage | Token / value |
|---|---|
| Field background | `rgba(255,255,255,0.04)` |
| Field border (default) | `border-border` (`#1f3a3a`) |
| Field border (focused / open) | `rgba(0,139,139,0.45)` |
| Calendar popup background | `bg-[#071212]` |
| Selected day background | `rgba(0,139,139,0.3)` |
| Selected day text | `color: #7df9ff` (inline style) |
| Selected day border | `rgba(0,139,139,0.5)` |
| Other-month day opacity | `rgba(122,168,168,0.2)` |
| Stepper divider | `bg-border` |
| Stepper hover | `bg-[rgba(0,139,139,0.12)] text-accent` |

---

## 3. `DatePicker` Component (inline in `SubscriptionForm.tsx`)

### Interface

```ts
interface DatePickerProps {
  value: string;          // 'YYYY-MM-DD'
  onChange: (v: string) => void;
}
```

### Behaviour

- **Display row**: shows value as `dd/MM/yyyy` (Vietnamese locale) + Lucide `Calendar` icon (14 px, `text-muted`). Clicking opens the calendar popup.
- **Popup**: renders below the display row, `position: absolute`, `z-index: 50`. Clicking outside (via `useEffect` + document `mousedown` listener) closes it.
- **Month navigation**: `ChevronLeft` / `ChevronRight` Lucide icons (14 px). Clicking changes the viewed month without changing the selected value.
- **Day grid**: 7 columns (T2 T3 T4 T5 T6 T7 CN). Days outside the current month are rendered at `opacity-20`, non-clickable.
- **Selected day**: highlighted with teal glass pill (`bg-[rgba(0,139,139,0.3)] border border-[rgba(0,139,139,0.5)]`, text `color:#7df9ff`).
- **Click a day**: sets value as `'YYYY-MM-DD'`, closes popup.
- **No keyboard navigation required** (admin-only internal tool).

### Markup skeleton

```tsx
function DatePicker({ value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState<number>(...);
  const [viewMonth, setViewMonth] = useState<number>(...);
  const ref = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => { ... }, [open]);

  // derive grid of {day, currentMonth} objects for the viewed month
  const days = buildCalendarDays(viewYear, viewMonth);

  return (
    <div ref={ref} className="relative">
      {/* Display row */}
      <div onClick={() => setOpen(!open)} className="...">
        <span>{formatDisplay(value)}</span>
        <Calendar size={14} className="text-muted" />
      </div>
      {/* Popup */}
      {open && (
        <div className="absolute z-50 mt-1 ...">
          {/* header: prev / month+year / next */}
          {/* day-of-week headers: T2 T3 T4 T5 T6 T7 CN */}
          {/* day cells */}
        </div>
      )}
    </div>
  );
}
```

### Helper: `buildCalendarDays`

Returns an array of `{ date: Date; currentMonth: boolean }` covering the 6-week grid (42 cells) starting from Monday of the week containing the 1st of `viewMonth`. Pure function, no state.

### Helper: `formatDisplay`

Converts `'YYYY-MM-DD'` → `'dd/MM/yyyy'` string (e.g. `'15/05/2026'`). Returns `''` when value is empty.

---

## 4. `Stepper` Component (inline in `SubscriptionForm.tsx`)

### Interface

```ts
interface StepperProps {
  value: string;
  onChange: (v: string) => void;
  min?: number;   // default 1
  max?: number;   // default 365
}
```

### Behaviour

- Layout: `[−] | <value> | [+]` in a single pill (border, rounded-xl).
- `−` decrements by 1, clamps at `min`. Disabled (opacity-40, no pointer) when `value === min`.
- `+` increments by 1, clamps at `max`. Disabled when `value === max`.
- Center area is a plain `<input type="text" inputMode="numeric">` so the admin can also type directly. On blur: parse, clamp to [min, max], call `onChange`.
- Width: `min-w-[140px]`, `w-fit`.

### Markup skeleton

```tsx
function Stepper({ value, onChange, min = 1, max = 365 }: StepperProps) {
  const n = Number(value);
  const dec = () => onChange(String(Math.max(min, n - 1)));
  const inc = () => onChange(String(Math.min(max, n + 1)));
  return (
    <div className="inline-flex items-center border border-border rounded-xl overflow-hidden bg-white/[0.04] min-w-[140px]">
      <button type="button" onClick={dec} disabled={n <= min} className="...">−</button>
      <div className="w-px h-5 bg-border" />
      <input
        type="text" inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => { const v = Math.min(max, Math.max(min, Number(e.target.value) || min)); onChange(String(v)); }}
        className="flex-1 text-center bg-transparent text-fg text-sm outline-none py-2.5 min-w-[40px]"
      />
      <div className="w-px h-5 bg-border" />
      <button type="button" onClick={inc} disabled={n >= max} className="...">+</button>
    </div>
  );
}
```

---

## 5. Button Row

Replace current large rounded-full submit button with:

```tsx
<div className="flex items-center gap-3 pt-1">
  <button
    type="submit"
    disabled={submitting}
    className="bg-gradient-brand rounded-lg px-4 py-2.5 text-sm font-semibold text-fg shadow-glow disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
  >
    {submitting ? 'Đang tạo...' : 'Tạo gói đăng ký'}
  </button>
  <Link href="/admin/subscriptions" className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted hover:text-fg transition-colors">
    Huỷ
  </Link>
</div>
```

Key changes vs current:
- `rounded-full` → `rounded-lg`
- `px-6 py-3` → `px-4 py-2.5`
- `self-start` → inside a flex row with the Cancel link
- Cancel `Link` uses `href="/admin/subscriptions"` (back to list)

---

## 6. Field Structure (unchanged except `gap-6` between fields)

```tsx
<form className="w-full max-w-xl flex flex-col gap-6">
  <label className="flex flex-col gap-1.5">
    <span className="text-[9px] uppercase tracking-[0.18em] text-muted font-medium">Label</span>
    {/* input / stepper / date-picker */}
  </label>
</form>
```

- `gap-5` → `gap-6` between fields (more breathing room)
- `gap-2` → `gap-1.5` between label and its control (tighter label-to-input, more space between fields)

### Toggle group width fix

The `Loại gói` toggle currently stretches full width because `inline-flex` children inside a `flex flex-col` parent still get `align-items: stretch` by default. Fix: add `self-start` to the toggle wrapper so it shrinks to fit content:

```tsx
<div className="inline-flex self-start rounded-lg border border-border overflow-hidden">
  <button ...>Dùng thử</button>
  <button ...>Trả phí</button>
</div>
```

---

## 7. Page Header (`new/page.tsx`)

Update to match the standardised header used by the list page (no CTA button needed here):

```tsx
<div className="px-6 py-8 space-y-6">
  <div>
    <h1 className="text-lg font-bold text-fg">Thêm gói đăng ký mới</h1>
    <p className="mt-1 text-xs text-muted">Tạo gói dùng thử hoặc trả phí cho một số điện thoại.</p>
  </div>
  <SubscriptionForm />
</div>
```

---

## 8. What Does NOT Change

- `useCreateSubscription` hook — untouched
- `validateLocal` / `handleSubmit` / `errFor` — untouched
- `InlineError` component — untouched
- Phone normalisation & blur handler — untouched
- `toE164VN` / `dateInputToEpochMs` / `todayLocalISO` helpers — untouched
- Payment ref field (shown/hidden for `paid` type) — untouched
- Global error banner — untouched

---

## 9. Testing

- **No new Vitest tests**: purely presentational changes. Existing `SubscriptionForm` tests cover validation logic which is unchanged.
- **Visual check**: run `npm run dev`, navigate to `/admin/subscriptions/new`, verify calendar opens/closes on click, selected date highlights correctly, stepper clamps at 1 and 365, Cancel navigates back to the list.
- **Playwright**: existing E2E specs must still pass unchanged.
