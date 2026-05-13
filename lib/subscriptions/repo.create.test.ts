import { describe, it, expect, vi, beforeEach } from 'vitest';

// firebase-admin/database mock surface. We expose `ref()` as a fluent
// builder with the methods the repo uses: push() (sync, returns { key }),
// transaction() (async), update() (async), and once() (async).
const {
  pushMock,
  transactionMock,
  updateMock,
  refSpy,
} = vi.hoisted(() => {
  return {
    pushMock: vi.fn(),
    transactionMock: vi.fn(),
    updateMock: vi.fn(),
    refSpy: vi.fn(),
  };
});

vi.mock('firebase-admin/database', () => ({
  getDatabase: () => ({
    ref: (path?: string) => {
      refSpy(path);
      return {
        push: () => pushMock(),
        transaction: (cb: (current: unknown) => unknown) =>
          transactionMock(cb),
        update: (updates: Record<string, unknown>) => updateMock(updates),
      };
    },
  }),
}));
vi.mock('@/features/admin/lib/firebaseAdmin', () => ({
  getAdminApp: () => ({}),
}));

import {
  createSubscription,
  type CreateSubscriptionArgs,
} from './repo';

const VALID_PHONE = '+84901234567';

function defaultArgs(
  overrides: Partial<CreateSubscriptionArgs> = {},
): CreateSubscriptionArgs {
  return {
    userPhone: VALID_PHONE,
    type: 'trial',
    durationDays: 14,
    paymentRef: null,
    startDate: 1_700_000_000_000,
    source: 'manual_admin',
    createdBy: 'admin-uid',
    ...overrides,
  };
}

function resetMocks(opts: { newKey?: string } = {}) {
  pushMock.mockReset();
  transactionMock.mockReset();
  updateMock.mockReset();
  refSpy.mockReset();
  pushMock.mockReturnValue({ key: opts.newKey ?? 'new-id' });
  // Default: transaction commits with `true`.
  transactionMock.mockResolvedValue({
    committed: true,
    snapshot: { val: () => true },
  });
  updateMock.mockResolvedValue(undefined);
}

describe('createSubscription — trial happy path', () => {
  beforeEach(() => resetMocks({ newKey: 'trial-id' }));

  it('claims the trial flag, writes record + by-phone pointer, returns id', async () => {
    const result = await createSubscription(defaultArgs());
    expect(result).toEqual({ ok: true, id: 'trial-id' });

    // Trial flag claimed via transaction.
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(refSpy).toHaveBeenCalledWith(
      `subscriptionTrialClaimed/${VALID_PHONE}`,
    );

    // Multi-path update wrote subscription + pointer.
    expect(updateMock).toHaveBeenCalledTimes(1);
    const updates = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(updates[`subscriptions/trial-id`]).toBeDefined();
    expect(updates[`subscriptionsByPhone/${VALID_PHONE}/trial-id`]).toBe(true);

    const rec = updates[`subscriptions/trial-id`] as Record<string, unknown>;
    expect(rec.userPhone).toBe(VALID_PHONE);
    expect(rec.userId).toBeNull();
    expect(rec.type).toBe('trial');
    expect(rec.status).toBe('active');
    expect(rec.paymentRef).toBeNull();
    expect(rec.source).toBe('manual_admin');
    expect(rec.createdBy).toBe('admin-uid');
    expect(rec.startDate).toBe(1_700_000_000_000);
    expect(rec.endDate).toBe(1_700_000_000_000 + 14 * 86_400_000);
    // `id` MUST NOT be stored inside the record — the rules' $other:false
    // would reject it.
    expect('id' in rec).toBe(false);
  });
});

describe('createSubscription — paid happy path', () => {
  beforeEach(() => resetMocks({ newKey: 'paid-id' }));

  it('skips the trial transaction, writes record + pointer', async () => {
    const result = await createSubscription(
      defaultArgs({ type: 'paid', paymentRef: 'PAY-1' }),
    );
    expect(result).toEqual({ ok: true, id: 'paid-id' });

    // Paid never touches subscriptionTrialClaimed.
    expect(transactionMock).not.toHaveBeenCalled();
    expect(refSpy).not.toHaveBeenCalledWith(
      `subscriptionTrialClaimed/${VALID_PHONE}`,
    );

    const updates = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(updates[`subscriptions/paid-id`]).toBeDefined();
    const rec = updates[`subscriptions/paid-id`] as Record<string, unknown>;
    expect(rec.type).toBe('paid');
    expect(rec.paymentRef).toBe('PAY-1');
  });
});

describe('createSubscription — trial uniqueness', () => {
  it('returns trial_already_claimed when the transaction aborts', async () => {
    resetMocks();
    transactionMock.mockResolvedValueOnce({
      committed: false,
      snapshot: { val: () => true },
    });
    const result = await createSubscription(defaultArgs());
    expect(result).toEqual({ ok: false, error: 'trial_already_claimed' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('handles concurrent trials — one wins, the other gets trial_already_claimed', async () => {
    // Simulate two callers. The first transaction commits; the second sees
    // current === true and aborts.
    const states = { claimed: false };
    pushMock.mockImplementation(() => ({
      key: 'id-' + Math.random().toString(36).slice(2),
    }));
    transactionMock.mockImplementation(
      async (cb: (current: unknown) => unknown) => {
        const current = states.claimed ? true : null;
        const next = cb(current);
        if (next === undefined) {
          return { committed: false, snapshot: { val: () => current } };
        }
        states.claimed = next === true;
        return { committed: true, snapshot: { val: () => next } };
      },
    );
    updateMock.mockResolvedValue(undefined);

    const [a, b] = await Promise.all([
      createSubscription(defaultArgs()),
      createSubscription(defaultArgs()),
    ]);
    const okCount = [a, b].filter((r) => r.ok).length;
    const lockedCount = [a, b].filter(
      (r) => !r.ok && r.error === 'trial_already_claimed',
    ).length;
    expect(okCount).toBe(1);
    expect(lockedCount).toBe(1);
  });

  it('paid is not blocked by an existing trial claim', async () => {
    // The repo never invokes the trial transaction for paid; pre-existing
    // trial flag is irrelevant.
    resetMocks({ newKey: 'paid-renewal' });
    const result = await createSubscription(
      defaultArgs({ type: 'paid', paymentRef: 'PAY-X' }),
    );
    expect(result.ok).toBe(true);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

describe('createSubscription — paid renewals', () => {
  it('two paid subscriptions for the same phone both succeed and produce distinct ids', async () => {
    // First call → 'paid-1', second → 'paid-2'. Both updates land
    // independently; no in-place mutation.
    pushMock.mockReset();
    transactionMock.mockReset();
    updateMock.mockReset();
    refSpy.mockReset();
    pushMock
      .mockReturnValueOnce({ key: 'paid-1' })
      .mockReturnValueOnce({ key: 'paid-2' });
    transactionMock.mockResolvedValue({
      committed: true,
      snapshot: { val: () => true },
    });
    updateMock.mockResolvedValue(undefined);

    const r1 = await createSubscription(
      defaultArgs({ type: 'paid', paymentRef: 'PAY-001' }),
    );
    const r2 = await createSubscription(
      defaultArgs({ type: 'paid', paymentRef: 'PAY-002' }),
    );
    expect(r1).toEqual({ ok: true, id: 'paid-1' });
    expect(r2).toEqual({ ok: true, id: 'paid-2' });
    expect(updateMock).toHaveBeenCalledTimes(2);

    const u1 = updateMock.mock.calls[0][0] as Record<string, unknown>;
    const u2 = updateMock.mock.calls[1][0] as Record<string, unknown>;
    expect(u1[`subscriptionsByPhone/${VALID_PHONE}/paid-1`]).toBe(true);
    expect(u2[`subscriptionsByPhone/${VALID_PHONE}/paid-2`]).toBe(true);
  });
});

describe('createSubscription — validation', () => {
  beforeEach(() => resetMocks());

  it('rejects invalid durationDays without any RTDB writes', async () => {
    const result = await createSubscription(
      defaultArgs({ durationDays: 0 }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('invalid_input');
    expect(updateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('rejects paid without paymentRef', async () => {
    const result = await createSubscription(
      defaultArgs({ type: 'paid', paymentRef: null }),
    );
    expect(result.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects trial with non-null paymentRef', async () => {
    const result = await createSubscription(
      defaultArgs({ type: 'trial', paymentRef: 'SHOULD-NOT' }),
    );
    expect(result.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects userPhone that is not in canonical +84 form', async () => {
    const result = await createSubscription(
      defaultArgs({ userPhone: '0901234567' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('invalid_input');
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe('createSubscription — rtdb failure', () => {
  it('returns rtdb_write_failed and attempts trial-claim rollback', async () => {
    resetMocks({ newKey: 'will-fail' });
    updateMock.mockRejectedValueOnce(new Error('boom'));
    // First transaction call (claim) commits; second call (rollback)
    // is invoked after the failed update.
    transactionMock
      .mockResolvedValueOnce({
        committed: true,
        snapshot: { val: () => true },
      })
      .mockResolvedValueOnce({
        committed: true,
        snapshot: { val: () => null },
      });

    const result = await createSubscription(defaultArgs());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('rtdb_write_failed');
    expect(transactionMock).toHaveBeenCalledTimes(2);
  });

  it('paid rtdb failure: no rollback transaction invoked', async () => {
    resetMocks({ newKey: 'paid-fail' });
    updateMock.mockRejectedValueOnce(new Error('boom'));

    const result = await createSubscription(
      defaultArgs({ type: 'paid', paymentRef: 'PAY-X' }),
    );
    expect(result.ok).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
