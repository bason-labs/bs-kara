import { describe, it, expect } from 'vitest';
import {
  filterSubscriptions,
  type SubscriptionFilters,
} from './SubscriptionsTable';
import { DAY_MS, type SubscriptionRecord } from '@/lib/subscriptions/schema';

const NOW = 1_700_000_000_000;

function rec(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    id: 'r' + (overrides.id ?? Math.random().toString(36).slice(2)),
    userPhone: '+84901234567',
    userId: null,
    type: 'trial',
    status: 'active',
    durationDays: 14,
    startDate: 0,
    endDate: NOW + 30 * DAY_MS,
    source: 'manual_admin',
    paymentRef: null,
    createdBy: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const ALL: SubscriptionFilters = {
  type: 'all',
  status: 'all',
  source: 'all',
  expiringSoon: false,
};

describe('filterSubscriptions', () => {
  it('returns input unchanged when all filters are "all" and expiringSoon=false', () => {
    const data = [rec({ id: '1' }), rec({ id: '2', type: 'paid', paymentRef: 'p' })];
    expect(filterSubscriptions(data, ALL, NOW)).toEqual(data);
  });

  it('type=trial keeps only trial', () => {
    const data = [
      rec({ id: '1', type: 'trial' }),
      rec({ id: '2', type: 'paid', paymentRef: 'p' }),
    ];
    const out = filterSubscriptions(data, { ...ALL, type: 'trial' }, NOW);
    expect(out.map((r) => r.id)).toEqual(['1']);
  });

  it('type=paid keeps only paid', () => {
    const data = [
      rec({ id: '1', type: 'trial' }),
      rec({ id: '2', type: 'paid', paymentRef: 'p' }),
    ];
    const out = filterSubscriptions(data, { ...ALL, type: 'paid' }, NOW);
    expect(out.map((r) => r.id)).toEqual(['2']);
  });

  it('status=expired uses derive() — endDate in past with status=active counts as expired', () => {
    const data = [
      rec({ id: 'A', endDate: NOW + DAY_MS }), // active
      rec({ id: 'E', endDate: NOW - DAY_MS }), // expired (derived)
      rec({ id: 'C', status: 'cancelled' }),
    ];
    const out = filterSubscriptions(data, { ...ALL, status: 'expired' }, NOW);
    expect(out.map((r) => r.id)).toEqual(['E']);
  });

  it('status=cancelled keeps only cancelled', () => {
    const data = [
      rec({ id: 'A' }),
      rec({ id: 'C', status: 'cancelled' }),
    ];
    const out = filterSubscriptions(data, { ...ALL, status: 'cancelled' }, NOW);
    expect(out.map((r) => r.id)).toEqual(['C']);
  });

  it('source=payment_webhook keeps only that source', () => {
    const data = [
      rec({ id: '1', source: 'manual_admin' }),
      rec({ id: '2', source: 'payment_webhook' }),
      rec({ id: '3', source: 'self_register_phone' }),
    ];
    const out = filterSubscriptions(
      data,
      { ...ALL, source: 'payment_webhook' },
      NOW,
    );
    expect(out.map((r) => r.id)).toEqual(['2']);
  });

  it('expiringSoon=true keeps only active records with endDate within 7d', () => {
    const data = [
      rec({ id: 'A', endDate: NOW + 3 * DAY_MS }), // expiring soon
      rec({ id: 'B', endDate: NOW + 6.5 * DAY_MS }), // expiring soon (< 7d)
      rec({ id: 'C', endDate: NOW + 30 * DAY_MS }), // active but far out
      rec({ id: 'D', endDate: NOW - DAY_MS }), // expired
      rec({
        id: 'E',
        status: 'cancelled',
        endDate: NOW + DAY_MS,
      }), // cancelled
    ];
    const out = filterSubscriptions(
      data,
      { ...ALL, expiringSoon: true },
      NOW,
    );
    expect(out.map((r) => r.id).sort()).toEqual(['A', 'B']);
  });

  it('expiringSoon boundary: endDate at exactly now + 7d is NOT expiring soon', () => {
    const data = [
      rec({ id: 'edge', endDate: NOW + 7 * DAY_MS }),
      rec({ id: 'inside', endDate: NOW + 7 * DAY_MS - 1 }),
    ];
    const out = filterSubscriptions(
      data,
      { ...ALL, expiringSoon: true },
      NOW,
    );
    expect(out.map((r) => r.id)).toEqual(['inside']);
  });

  it('combines filters with AND semantics (type=paid AND status=active)', () => {
    const data = [
      rec({
        id: '1',
        type: 'paid',
        paymentRef: 'p',
        endDate: NOW + DAY_MS,
      }),
      rec({
        id: '2',
        type: 'paid',
        paymentRef: 'p',
        endDate: NOW - DAY_MS,
      }), // paid but expired
      rec({ id: '3', type: 'trial', endDate: NOW + DAY_MS }), // active but trial
    ];
    const out = filterSubscriptions(
      data,
      { ...ALL, type: 'paid', status: 'active' },
      NOW,
    );
    expect(out.map((r) => r.id)).toEqual(['1']);
  });
});
