import {
  DAY_MS,
  SubscriptionRecordSchema,
  type SubscriptionRecord,
  type UpdateSubscriptionInput,
} from './schema';

export type ApplyUpdateResult =
  | { ok: true; record: SubscriptionRecord }
  | { ok: false; field: string; message: string };

// Merge an admin edit into a record. Pure: the repo reads, calls this, writes.
// Re-validates the merged record with the read schema, so a saved edit always
// parses back (e.g. a paid record keeps a non-empty paymentRef).
export function applySubscriptionUpdate(
  record: SubscriptionRecord,
  changes: UpdateSubscriptionInput,
  now: number,
): ApplyUpdateResult {
  const startDate = changes.startDate ?? record.startDate;
  const durationDays = changes.durationDays ?? record.durationDays;
  const merged = {
    ...record,
    status: changes.status ?? record.status,
    startDate,
    durationDays,
    endDate: startDate + durationDays * DAY_MS,
    paymentRef: changes.paymentRef === undefined ? record.paymentRef : changes.paymentRef || null,
    updatedAt: now,
  };
  const parsed = SubscriptionRecordSchema.safeParse(merged);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, field: issue.path.join('.') || '_root', message: issue.message };
  }
  return { ok: true, record: parsed.data };
}
