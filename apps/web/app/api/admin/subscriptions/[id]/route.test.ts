import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const repo = vi.hoisted(() => ({
  cancelSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
  getSubscription: vi.fn(),
  updateSubscription: vi.fn(),
}));
const auth = vi.hoisted(() => ({ requireAdmin: vi.fn() }));

vi.mock('@/server/subscriptions/repo', () => repo);
vi.mock('@/server/admin/requireAdmin', () => {
  class AdminAuthError extends Error {
    constructor(public code: string) {
      super(code);
    }
  }
  return { AdminAuthError, requireAdmin: auth.requireAdmin };
});

import { PATCH, DELETE } from './route';
import { AdminAuthError } from '@/server/admin/requireAdmin';

const ctx = { params: Promise.resolve({ id: 'sub1' }) };
const patch = (body: unknown) =>
  PATCH(new NextRequest('http://localhost/api/admin/subscriptions/sub1', { method: 'PATCH', body: JSON.stringify(body) }), ctx);
const del = () => DELETE(new NextRequest('http://localhost/api/admin/subscriptions/sub1', { method: 'DELETE' }), ctx);

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireAdmin.mockResolvedValue({ uid: 'admin1' });
});

describe('PATCH action update', () => {
  it('saves the changes and passes the admin uid', async () => {
    repo.updateSubscription.mockResolvedValue({ ok: true, record: { id: 'sub1' } });
    const res = await patch({ action: 'update', changes: { status: 'active', durationDays: 30 } });
    expect(res.status).toBe(200);
    expect(repo.updateSubscription).toHaveBeenCalledWith('sub1', { status: 'active', durationDays: 30 }, 'admin1');
  });

  it.each([
    ['a locked field', { userPhone: '+84900000000' }, 'userPhone'],
    ['an out-of-range duration', { durationDays: 0 }, 'durationDays'],
  ])('returns 400 for %s without writing', async (_label, changes, field) => {
    const res = await patch({ action: 'update', changes });
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toHaveProperty(field);
    expect(repo.updateSubscription).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, error: 'not_found' }, 404],
    [{ ok: false, error: 'invalid_input', field: 'paymentRef', message: 'x' }, 400],
    [{ ok: false, error: 'rtdb_write_failed', details: 'boom' }, 500],
  ])('maps repo result %o to %i', async (result, status) => {
    repo.updateSubscription.mockResolvedValue(result);
    const res = await patch({ action: 'update', changes: { status: 'active' } });
    expect(res.status).toBe(status);
  });

  it('keeps the cancel action working', async () => {
    repo.cancelSubscription.mockResolvedValue({ ok: true });
    expect((await patch({ action: 'cancel' })).status).toBe(200);
  });
});

describe('DELETE', () => {
  it.each([
    [{ ok: true }, 200],
    [{ ok: false, error: 'not_found' }, 404],
    [{ ok: false, error: 'rtdb_write_failed', details: 'boom' }, 500],
  ])('maps repo result %o to %i', async (result, status) => {
    repo.deleteSubscription.mockResolvedValue(result);
    expect((await del()).status).toBe(status);
  });

  it('rejects a caller who is not an admin', async () => {
    auth.requireAdmin.mockRejectedValue(new AdminAuthError('no_cookie'));
    expect((await del()).status).toBe(401);
    expect(repo.deleteSubscription).not.toHaveBeenCalled();
  });
});
