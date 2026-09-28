import { describe, it, expect } from 'vitest';
import { applySubscriptionUpdate } from './update';
import { UpdateSubscriptionInputSchema, type SubscriptionRecord } from './schema';

const DAY = 86_400_000;
const trial: SubscriptionRecord = {
  id: 'r1', userPhone: '+84901234567', userId: null, type: 'trial', status: 'active',
  durationDays: 14, startDate: 0, endDate: 14 * DAY, source: 'manual_admin',
  paymentRef: null, createdBy: 'admin', createdAt: 0, updatedAt: 0,
};
const paid: SubscriptionRecord = { ...trial, type: 'paid', paymentRef: 'INV-1' };

describe('applySubscriptionUpdate', () => {
  it('reactivates a cancelled subscription', () => {
    const r = applySubscriptionUpdate({ ...trial, status: 'cancelled' }, { status: 'active' }, 5);
    expect(r).toMatchObject({ ok: true, record: { status: 'active', updatedAt: 5 } });
  });

  it.each([
    ['durationDays', { durationDays: 30 }, 30 * DAY],
    ['startDate', { startDate: 2 * DAY }, 16 * DAY],
  ])('recomputes endDate when %s changes', (_f, changes, endDate) => {
    const r = applySubscriptionUpdate(trial, changes, 1);
    expect(r.ok && r.record.endDate).toBe(endDate);
  });

  it.each([
    ['a paymentRef on a trial', trial, { paymentRef: 'X' }],
    ['an empty paymentRef on a paid plan', paid, { paymentRef: '' }],
  ])('rejects %s', (_label, record, changes) => {
    const r = applySubscriptionUpdate(record, changes, 1);
    expect(r).toMatchObject({ ok: false, field: 'paymentRef' });
  });
});

describe('UpdateSubscriptionInputSchema', () => {
  it.each([{ userPhone: '+84900000000' }, { type: 'paid' }, { durationDays: 0 }, { durationDays: 366 }])(
    'rejects %o (locked field or out of range)',
    (input) => {
      expect(UpdateSubscriptionInputSchema.safeParse(input).success).toBe(false);
    },
  );
});
