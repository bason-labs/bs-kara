import { describe, it, expect } from 'vitest';
import { derive, daysLeft } from './expiry';
import { DAY_MS, type SubscriptionRecord } from './schema';

function rec(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    id: 'r1',
    userPhone: '+84901234567',
    userId: null,
    type: 'trial',
    status: 'active',
    durationDays: 14,
    startDate: 0,
    endDate: 0,
    source: 'manual_admin',
    paymentRef: null,
    createdBy: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const NOW = 1_700_000_000_000;

describe('derive', () => {
  it('active + endDate in the future → active', () => {
    expect(derive(rec({ endDate: NOW + DAY_MS }), NOW)).toBe('active');
  });

  it('active + endDate in the past → expired', () => {
    expect(derive(rec({ endDate: NOW - DAY_MS }), NOW)).toBe('expired');
  });

  it('active + endDate exactly === now → expired', () => {
    expect(derive(rec({ endDate: NOW }), NOW)).toBe('expired');
  });

  it('cancelled + endDate in the future → cancelled (status wins)', () => {
    expect(
      derive(rec({ status: 'cancelled', endDate: NOW + DAY_MS }), NOW),
    ).toBe('cancelled');
  });

  it('cancelled + endDate in the past → cancelled', () => {
    expect(
      derive(rec({ status: 'cancelled', endDate: NOW - DAY_MS }), NOW),
    ).toBe('cancelled');
  });
});

describe('daysLeft', () => {
  it('active + 5 days remaining → 5', () => {
    expect(daysLeft(rec({ endDate: NOW + 5 * DAY_MS }), NOW)).toBe(5);
  });

  it('active + 4.5 days remaining → 5 (ceiling)', () => {
    expect(daysLeft(rec({ endDate: NOW + 4.5 * DAY_MS }), NOW)).toBe(5);
  });

  it('active + endDate in past → 0 (Math.max guard)', () => {
    expect(daysLeft(rec({ endDate: NOW - DAY_MS }), NOW)).toBe(0);
  });

  it('active + endDate === now → 0', () => {
    expect(daysLeft(rec({ endDate: NOW }), NOW)).toBe(0);
  });

  it('cancelled → 0 regardless of endDate', () => {
    expect(
      daysLeft(rec({ status: 'cancelled', endDate: NOW + 10 * DAY_MS }), NOW),
    ).toBe(0);
  });
});
