import { DAY_MS, type DerivedStatus, type SubscriptionRecord } from './schema';

// THE rule for "does this subscription grant access now": stored status
// 'active' and now inside [startDate, endDate). Accepts raw RTDB values, so the
// room-access and voice checks use it on unparsed records.
export function isSubscriptionLive(
  sub: { status?: unknown; startDate?: unknown; endDate?: unknown } | null | undefined,
  now: number,
): boolean {
  return (
    !!sub &&
    sub.status === 'active' &&
    typeof sub.startDate === 'number' &&
    typeof sub.endDate === 'number' &&
    sub.startDate <= now &&
    now < sub.endDate
  );
}

// Derive the on-read status. 'expired' and 'scheduled' are computed here and
// NEVER stored. 'active' here ⇔ isSubscriptionLive. Edge cases:
//   - status='cancelled' wins regardless of dates.
//   - endDate exactly === now → 'expired' (the window has closed).
//   - startDate exactly === now → 'active' (the window has opened).
export function derive(record: SubscriptionRecord, now: number): DerivedStatus {
  if (record.status === 'cancelled') return 'cancelled';
  if (record.endDate <= now) return 'expired';
  if (record.startDate > now) return 'scheduled';
  return 'active';
}

// Whole days remaining, ceiling-rounded so a partial day still counts as
// one. Returns 0 for cancelled records and for already-expired records
// (Math.max guard).
export function daysLeft(record: SubscriptionRecord, now: number): number {
  if (record.status === 'cancelled') return 0;
  return Math.max(0, Math.ceil((record.endDate - now) / DAY_MS));
}
