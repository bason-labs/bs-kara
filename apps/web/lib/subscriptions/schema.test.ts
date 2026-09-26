import { describe, it, expect } from 'vitest';
import {
  SubscriptionRecordSchema,
  CreateSubscriptionInputSchema,
  type SubscriptionRecord,
} from './schema';

function validRecord(
  overrides: Partial<SubscriptionRecord> = {},
): SubscriptionRecord {
  return {
    id: 'r1',
    userPhone: '+84901234567',
    userId: null,
    type: 'trial',
    status: 'active',
    durationDays: 14,
    startDate: 0,
    endDate: 14 * 86_400_000,
    source: 'manual_admin',
    paymentRef: null,
    createdBy: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('SubscriptionRecordSchema', () => {
  it('accepts a valid trial record', () => {
    const parsed = SubscriptionRecordSchema.safeParse(validRecord());
    expect(parsed.success).toBe(true);
  });

  it('accepts a valid paid record with paymentRef', () => {
    const parsed = SubscriptionRecordSchema.safeParse(
      validRecord({ type: 'paid', paymentRef: 'PAY-123' }),
    );
    expect(parsed.success).toBe(true);
  });

  it.each([
    { reason: 'trial with paymentRef set', over: { type: 'trial', paymentRef: 'WRONG' } },
    { reason: 'paid with paymentRef = null', over: { type: 'paid', paymentRef: null } },
    { reason: 'paid with paymentRef = ""', over: { type: 'paid', paymentRef: '' } },
    { reason: 'durationDays = 0', over: { durationDays: 0 } },
    { reason: 'durationDays = 366', over: { durationDays: 366 } },
    { reason: 'durationDays = 1.5 (integer enforced)', over: { durationDays: 1.5 } },
    { reason: 'userPhone without +84', over: { userPhone: '0901234567' } },
    { reason: 'userPhone with another country code', over: { userPhone: '+1234567890' } },
    { reason: 'an unknown extra field (strict mode)', over: { bogus: 1 } },
  ] as { reason: string; over: Record<string, unknown> }[])('rejects $reason', ({ over }) => {
    expect(SubscriptionRecordSchema.safeParse({ ...validRecord(), ...over }).success).toBe(false);
  });

  it('accepts both nullable userId branches', () => {
    expect(
      SubscriptionRecordSchema.safeParse(validRecord({ userId: null })).success,
    ).toBe(true);
    expect(
      SubscriptionRecordSchema.safeParse(validRecord({ userId: 'uid-1' })).success,
    ).toBe(true);
  });

  // Regression: Firebase RTDB silently drops null values on write. Fields
  // like userId, paymentRef, and createdBy come back as MISSING (undefined)
  // when read from the snapshot. The schema must accept undefined and
  // normalise it to null so listSubscriptions() doesn't silently drop
  // every row and the subscriptions list appears empty.
  it('accepts missing (undefined) nullable fields from Firebase and coerces them to null', () => {
    const { userId: _u, paymentRef: _p, createdBy: _c, ...rest } = validRecord();
    const parsed = SubscriptionRecordSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.userId).toBeNull();
      expect(parsed.data.paymentRef).toBeNull();
      expect(parsed.data.createdBy).toBeNull();
    }
  });

  it('rejects invalid status (e.g. "expired" cannot be stored)', () => {
    const r = { ...validRecord(), status: 'expired' } as unknown;
    expect(SubscriptionRecordSchema.safeParse(r).success).toBe(false);
  });
});

describe('CreateSubscriptionInputSchema', () => {
  const base = { userPhone: '0901234567', type: 'trial', durationDays: 14 };

  it.each([
    { reason: 'a trial without paymentRef', input: base },
    { reason: 'a paid input with paymentRef', input: { ...base, type: 'paid', paymentRef: 'PAY-1' } },
  ])('accepts $reason', ({ input }) => {
    expect(CreateSubscriptionInputSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    { reason: 'trial with non-null paymentRef', input: { ...base, paymentRef: 'OOPS' } },
    { reason: 'paid without paymentRef', input: { ...base, type: 'paid' } },
    { reason: 'paid with empty paymentRef', input: { ...base, type: 'paid', paymentRef: '' } },
    { reason: 'durationDays = 0', input: { ...base, durationDays: 0 } },
    { reason: 'durationDays = 366', input: { ...base, durationDays: 366 } },
    { reason: 'an unknown extra field', input: { ...base, bogus: true } },
  ])('rejects $reason', ({ input }) => {
    expect(CreateSubscriptionInputSchema.safeParse(input).success).toBe(false);
  });
});
