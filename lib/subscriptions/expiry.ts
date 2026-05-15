import { DAY_MS, type DerivedStatus, type SubscriptionRecord } from './schema';

// Derive the on-read status. 'expired' is computed here and NEVER stored.
// Edge cases:
//   - status='cancelled' wins regardless of endDate (a cancelled record
//     with a future endDate is still cancelled).
//   - endDate exactly === now → 'expired' (strict less-than below — equal
//     is treated as expired because the window has closed).
export function derive(record: SubscriptionRecord, now: number): DerivedStatus {
  if (record.status === 'cancelled') return 'cancelled';
  if (record.endDate <= now) return 'expired';
  return 'active';
}

// Whole days remaining, ceiling-rounded so a partial day still counts as
// one. Returns 0 for cancelled records and for already-expired records
// (Math.max guard).
export function daysLeft(record: SubscriptionRecord, now: number): number {
  if (record.status === 'cancelled') return 0;
  return Math.max(0, Math.ceil((record.endDate - now) / DAY_MS));
}
