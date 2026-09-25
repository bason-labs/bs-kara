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

  it('rejects trial with paymentRef set', () => {
    const parsed = SubscriptionRecordSchema.safeParse(
      validRecord({ type: 'trial', paymentRef: 'WRONG' }),
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects paid with paymentRef = null', () => {
    const parsed = SubscriptionRecordSchema.safeParse(
      validRecord({ type: 'paid', paymentRef: null }),
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects paid with paymentRef = "" (empty string)', () => {
    const parsed = SubscriptionRecordSchema.safeParse(
      validRecord({ type: 'paid', paymentRef: '' }),
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects durationDays = 0', () => {
    expect(
      SubscriptionRecordSchema.safeParse(validRecord({ durationDays: 0 })).success,
    ).toBe(false);
  });

  it('rejects durationDays = 366', () => {
    expect(
      SubscriptionRecordSchema.safeParse(validRecord({ durationDays: 366 })).success,
    ).toBe(false);
  });

  it('rejects durationDays = 1.5 (integer enforced)', () => {
    expect(
      SubscriptionRecordSchema.safeParse(validRecord({ durationDays: 1.5 })).success,
    ).toBe(false);
  });

  it('rejects unknown extra field (strict mode)', () => {
    const r = { ...validRecord(), bogus: 1 } as unknown;
    expect(SubscriptionRecordSchema.safeParse(r).success).toBe(false);
  });

  it('rejects userPhone failing the +84 format', () => {
    expect(
      SubscriptionRecordSchema.safeParse(
        validRecord({ userPhone: '0901234567' }),
      ).success,
    ).toBe(false);
    expect(
      SubscriptionRecordSchema.safeParse(
        validRecord({ userPhone: '+1234567890' }),
      ).success,
    ).toBe(false);
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
  it('accepts a valid trial input without paymentRef', () => {
    expect(
      CreateSubscriptionInputSchema.safeParse({
        userPhone: '0901234567',
        type: 'trial',
        durationDays: 14,
      }).success,
    ).toBe(true);
  });

  it('accepts a valid paid input with paymentRef', () => {
    expect(
      CreateSubscriptionInputSchema.safeParse({
        userPhone: '0901234567',
        type: 'paid',
        durationDays: 30,
        paymentRef: 'PAY-1',
      }).success,
    ).toBe(true);
  });

  it('rejects trial input with non-null paymentRef', () => {
    expect(
      CreateSubscriptionInputSchema.safeParse({
        userPhone: '0901234567',
        type: 'trial',
        durationDays: 14,
        paymentRef: 'OOPS',
      }).success,
    ).toBe(false);
  });

  it('rejects paid input without paymentRef', () => {
    expect(
      CreateSubscriptionInputSchema.safeParse({
        userPhone: '0901234567',
        type: 'paid',
        durationDays: 30,
      }).success,
    ).toBe(false);
  });

  it('rejects paid input with empty paymentRef', () => {
    expect(
      CreateSubscriptionInputSchema.safeParse({
        userPhone: '0901234567',
        type: 'paid',
        durationDays: 30,
        paymentRef: '',
      }).success,
    ).toBe(false);
  });

  it('rejects durationDays outside 1..365', () => {
    expect(
      CreateSubscriptionInputSchema.safeParse({
        userPhone: '0901234567',
        type: 'trial',
        durationDays: 0,
      }).success,
    ).toBe(false);
    expect(
      CreateSubscriptionInputSchema.safeParse({
        userPhone: '0901234567',
        type: 'trial',
        durationDays: 366,
      }).success,
    ).toBe(false);
  });

  it('rejects unknown extra field', () => {
    expect(
      CreateSubscriptionInputSchema.safeParse({
        userPhone: '0901234567',
        type: 'trial',
        durationDays: 14,
        bogus: true,
      }).success,
    ).toBe(false);
  });
});
