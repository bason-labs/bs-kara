import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  requireAdminMock,
  getSubscriptionMock,
  cancelSubscriptionMock,
  AdminAuthErrorMock,
} = vi.hoisted(() => {
  class AdminAuthErrorMock extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.name = 'AdminAuthError';
      this.code = code;
    }
  }
  return {
    requireAdminMock: vi.fn(),
    getSubscriptionMock: vi.fn(),
    cancelSubscriptionMock: vi.fn(),
    AdminAuthErrorMock,
  };
});

vi.mock('@/features/admin/lib/requireAdmin', () => ({
  requireAdmin: requireAdminMock,
  AdminAuthError: AdminAuthErrorMock,
}));
vi.mock('@/lib/subscriptions/repo', () => ({
  getSubscription: getSubscriptionMock,
  cancelSubscription: cancelSubscriptionMock,
}));

import { GET, PATCH } from './route';

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patchReq(body: unknown): Request {
  return new Request('http://localhost/api/admin/subscriptions/abc', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const DAY_MS = 86_400_000;

// derive() compares the stored endDate against Date.now() inside the
// route handler, so fixtures must be built relative to the real clock,
// not against a frozen epoch — otherwise "active" rows become "expired"
// when run against a clock that has moved past the fixture date.
function record(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id: 'abc',
    userPhone: '+84901234567',
    userId: null,
    type: 'trial',
    status: 'active',
    durationDays: 14,
    startDate: now - 5 * DAY_MS,
    endDate: now + 9 * DAY_MS,
    source: 'manual_admin',
    paymentRef: null,
    createdBy: 'admin-uid',
    createdAt: now - 5 * DAY_MS,
    updatedAt: now - 5 * DAY_MS,
    ...overrides,
  };
}

describe('GET /api/admin/subscriptions/[id]', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    getSubscriptionMock.mockReset();
  });

  it('401 with no_cookie when unauth', async () => {
    requireAdminMock.mockRejectedValueOnce(new AdminAuthErrorMock('no_cookie'));
    const res = await GET(undefined as never, ctxFor('abc'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'no_cookie' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('400 invalid_id when id is empty string', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    const res = await GET(undefined as never, ctxFor(''));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_id' });
    expect(getSubscriptionMock).not.toHaveBeenCalled();
  });

  it('400 invalid_id when id is whitespace-only', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    const res = await GET(undefined as never, ctxFor('   '));
    expect(res.status).toBe(400);
  });

  it('404 when subscription not found', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    getSubscriptionMock.mockResolvedValueOnce(null);
    const res = await GET(undefined as never, ctxFor('missing'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('200 with derived fields for an active record', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    getSubscriptionMock.mockResolvedValueOnce(record());
    const res = await GET(undefined as never, ctxFor('abc'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.record).toBeDefined();
    expect(body.derivedStatus).toBe('active');
    expect(typeof body.daysLeft).toBe('number');
    expect(body.daysLeft).toBeGreaterThan(0);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('200 with derivedStatus=expired when endDate is in the past', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    getSubscriptionMock.mockResolvedValueOnce(
      record({ endDate: Date.now() - DAY_MS }),
    );
    const res = await GET(undefined as never, ctxFor('abc'));
    const body = await res.json();
    expect(body.derivedStatus).toBe('expired');
    expect(body.daysLeft).toBe(0);
  });

  it('200 with derivedStatus=cancelled when stored status is cancelled', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    getSubscriptionMock.mockResolvedValueOnce(
      record({ status: 'cancelled' }),
    );
    const res = await GET(undefined as never, ctxFor('abc'));
    const body = await res.json();
    expect(body.derivedStatus).toBe('cancelled');
    expect(body.daysLeft).toBe(0);
  });
});

describe('PATCH /api/admin/subscriptions/[id]', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    cancelSubscriptionMock.mockReset();
  });

  it('401 unauth', async () => {
    requireAdminMock.mockRejectedValueOnce(new AdminAuthErrorMock('no_cookie'));
    const res = await PATCH(
      patchReq({ action: 'cancel' }) as never,
      ctxFor('abc'),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'no_cookie' });
  });

  it('400 invalid_id', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    const res = await PATCH(
      patchReq({ action: 'cancel' }) as never,
      ctxFor(''),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_id');
  });

  it('400 invalid_input when body is not JSON', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    const req = new Request('http://localhost/api/admin/subscriptions/abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{',
    });
    const res = await PATCH(req as never, ctxFor('abc'));
    expect(res.status).toBe(400);
  });

  it('400 invalid_input when action is missing', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    const res = await PATCH(patchReq({}) as never, ctxFor('abc'));
    expect(res.status).toBe(400);
  });

  it('400 invalid_input when action is not "cancel"', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    const res = await PATCH(
      patchReq({ action: 'extend' }) as never,
      ctxFor('abc'),
    );
    expect(res.status).toBe(400);
  });

  it('400 invalid_input when body has extra fields (strict mode)', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    const res = await PATCH(
      patchReq({ action: 'cancel', evil: true }) as never,
      ctxFor('abc'),
    );
    expect(res.status).toBe(400);
  });

  it('200 happy path → calls cancelSubscription with id + admin uid', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'admin-7', email: 'a@x.io' });
    cancelSubscriptionMock.mockResolvedValueOnce({ ok: true });
    const res = await PATCH(
      patchReq({ action: 'cancel' }) as never,
      ctxFor('abc'),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(cancelSubscriptionMock).toHaveBeenCalledWith('abc', 'admin-7');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('404 with Vietnamese message on not_found', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    cancelSubscriptionMock.mockResolvedValueOnce({
      ok: false,
      error: 'not_found',
    });
    const res = await PATCH(
      patchReq({ action: 'cancel' }) as never,
      ctxFor('missing'),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
    expect(body.message).toContain('Không tìm thấy');
  });

  it('409 with Vietnamese message on already_cancelled', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    cancelSubscriptionMock.mockResolvedValueOnce({
      ok: false,
      error: 'already_cancelled',
    });
    const res = await PATCH(
      patchReq({ action: 'cancel' }) as never,
      ctxFor('abc'),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('already_cancelled');
    expect(body.message).toContain('đã được huỷ');
  });

  it('500 with no leaked details on rtdb_write_failed', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    cancelSubscriptionMock.mockResolvedValueOnce({
      ok: false,
      error: 'rtdb_write_failed',
      details: new Error('boom'),
    });
    const res = await PATCH(
      patchReq({ action: 'cancel' }) as never,
      ctxFor('abc'),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'internal' });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
