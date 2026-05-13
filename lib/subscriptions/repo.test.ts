import { describe, it, expect, vi, beforeEach } from 'vitest';

const refMock = vi.fn();
const onceMock = vi.fn();

vi.mock('firebase-admin/database', () => ({
  getDatabase: () => ({ ref: refMock }),
}));
vi.mock('@/features/admin/lib/firebaseAdmin', () => ({
  getAdminApp: () => ({}),
}));

import { listSubscriptions, getSubscription } from './repo';

function setRtdbValue(value: unknown, exists: boolean = value !== null) {
  onceMock.mockResolvedValueOnce({
    val: () => value,
    exists: () => exists,
  });
  refMock.mockImplementationOnce(() => ({ once: onceMock }));
}

const validRow = (overrides: Record<string, unknown> = {}) => ({
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
});

describe('listSubscriptions', () => {
  beforeEach(() => {
    refMock.mockReset();
    onceMock.mockReset();
  });

  it('returns [] when the subscriptions node does not exist', async () => {
    setRtdbValue(null, false);
    await expect(listSubscriptions()).resolves.toEqual([]);
  });

  it('returns [] when the node is empty', async () => {
    setRtdbValue({});
    await expect(listSubscriptions()).resolves.toEqual([]);
  });

  it('returns valid records and drops malformed rows with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setRtdbValue({
      'good-1': validRow(),
      'bad-1': validRow({ durationDays: 'thirty' }),
      'good-2': validRow({ type: 'paid', paymentRef: 'PAY-1' }),
    });
    const out = await listSubscriptions();
    const ids = out.map((r) => r.id).sort();
    expect(ids).toEqual(['good-1', 'good-2']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('populates id from the RTDB key', async () => {
    setRtdbValue({ 'key-from-rtdb': validRow() });
    const out = await listSubscriptions();
    expect(out[0].id).toBe('key-from-rtdb');
  });
});

describe('getSubscription', () => {
  beforeEach(() => {
    refMock.mockReset();
    onceMock.mockReset();
  });

  it('returns null on empty id without hitting RTDB', async () => {
    await expect(getSubscription('')).resolves.toBeNull();
    expect(refMock).not.toHaveBeenCalled();
  });

  it('returns null when the record is missing', async () => {
    setRtdbValue(null, false);
    await expect(getSubscription('missing')).resolves.toBeNull();
  });

  it('returns the parsed record', async () => {
    setRtdbValue(validRow());
    const out = await getSubscription('abc');
    expect(out?.id).toBe('abc');
    expect(out?.userPhone).toBe('+84901234567');
  });

  it('returns null + warns on a malformed record', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setRtdbValue(validRow({ durationDays: 'oops' }));
    await expect(getSubscription('abc')).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
