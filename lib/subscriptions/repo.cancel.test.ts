import { describe, it, expect, vi, beforeEach } from 'vitest';

// Reuse the same fluent stub pattern as repo.create.test.ts so the SDK
// surface is mocked consistently across the write-path test files.
const { onceMock, updateMock, refSpy } = vi.hoisted(() => ({
  onceMock: vi.fn(),
  updateMock: vi.fn(),
  refSpy: vi.fn(),
}));

vi.mock('firebase-admin/database', () => ({
  getDatabase: () => ({
    ref: (path?: string) => {
      refSpy(path);
      return {
        once: (event: string) => onceMock(event),
        update: (updates: Record<string, unknown>) => updateMock(updates),
      };
    },
  }),
}));
vi.mock('@/features/admin/lib/firebaseAdmin', () => ({
  getAdminApp: () => ({}),
}));

import { cancelSubscription } from './repo';

const VALID_PHONE = '+84901234567';

function validStoredRow(overrides: Record<string, unknown> = {}) {
  return {
    userPhone: VALID_PHONE,
    userId: null,
    type: 'trial',
    status: 'active',
    durationDays: 14,
    startDate: 1_700_000_000_000,
    endDate: 1_700_000_000_000 + 14 * 86_400_000,
    source: 'manual_admin',
    paymentRef: null,
    createdBy: 'admin-uid',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function setSnapshot(val: unknown, exists: boolean = val !== null) {
  onceMock.mockResolvedValueOnce({
    val: () => val,
    exists: () => exists,
  });
}

beforeEach(() => {
  onceMock.mockReset();
  updateMock.mockReset();
  refSpy.mockReset();
  updateMock.mockResolvedValue(undefined);
});

describe('cancelSubscription — happy path', () => {
  it('flips status to cancelled and bumps updatedAt; does not touch other fields', async () => {
    const original = validStoredRow();
    setSnapshot(original);
    const before = Date.now();
    const result = await cancelSubscription('sub-1', 'admin-uid');
    const after = Date.now();
    expect(result).toEqual({ ok: true });

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(refSpy).toHaveBeenCalledWith('subscriptions/sub-1');
    const updates = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(updates).sort()).toEqual(['status', 'updatedAt']);
    expect(updates.status).toBe('cancelled');
    expect(typeof updates.updatedAt).toBe('number');
    expect(updates.updatedAt as number).toBeGreaterThanOrEqual(before);
    expect(updates.updatedAt as number).toBeLessThanOrEqual(after);
  });

  it('does NOT touch subscriptionTrialClaimed or subscriptionsByPhone', async () => {
    setSnapshot(validStoredRow());
    await cancelSubscription('sub-1', 'admin-uid');
    const touchedPaths = refSpy.mock.calls.map((c) => c[0]);
    expect(
      touchedPaths.some(
        (p) =>
          typeof p === 'string' &&
          (p.startsWith('subscriptionTrialClaimed') ||
            p.startsWith('subscriptionsByPhone')),
      ),
    ).toBe(false);
  });

  it('writes a structured audit log line with id + adminUid + prevStatus', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setSnapshot(validStoredRow({ status: 'active' }));
    await cancelSubscription('sub-1', 'admin-7');
    const logged = logSpy.mock.calls
      .map((c) => c.map(String).join(' '))
      .join(' ');
    expect(logged).toContain('cancelled');
    expect(logged).toContain('sub-1');
    expect(logged).toContain('admin-7');
    expect(logged).toContain('active');
    logSpy.mockRestore();
  });
});

describe('cancelSubscription — error paths', () => {
  it('empty id → not_found without RTDB read', async () => {
    const result = await cancelSubscription('', 'admin-uid');
    expect(result).toEqual({ ok: false, error: 'not_found' });
    expect(onceMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('snapshot does not exist → not_found, no write', async () => {
    setSnapshot(null, false);
    const result = await cancelSubscription('missing', 'admin-uid');
    expect(result).toEqual({ ok: false, error: 'not_found' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('already cancelled → already_cancelled, no write', async () => {
    setSnapshot(validStoredRow({ status: 'cancelled' }));
    const result = await cancelSubscription('sub-1', 'admin-uid');
    expect(result).toEqual({ ok: false, error: 'already_cancelled' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('malformed record → not_found + warning, no write', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // durationDays as string fails the schema; treated as data corruption.
    setSnapshot(validStoredRow({ durationDays: 'thirty' }));
    const result = await cancelSubscription('sub-1', 'admin-uid');
    expect(result).toEqual({ ok: false, error: 'not_found' });
    expect(updateMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('read failure → rtdb_write_failed', async () => {
    onceMock.mockRejectedValueOnce(new Error('read boom'));
    const result = await cancelSubscription('sub-1', 'admin-uid');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('rtdb_write_failed');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('write failure → rtdb_write_failed', async () => {
    setSnapshot(validStoredRow());
    updateMock.mockRejectedValueOnce(new Error('write boom'));
    const result = await cancelSubscription('sub-1', 'admin-uid');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('rtdb_write_failed');
  });
});
