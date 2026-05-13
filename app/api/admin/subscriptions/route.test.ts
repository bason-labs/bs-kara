import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  requireAdminMock,
  listSubscriptionsMock,
  createSubscriptionMock,
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
    listSubscriptionsMock: vi.fn(),
    createSubscriptionMock: vi.fn(),
    AdminAuthErrorMock,
  };
});

vi.mock('@/features/admin/lib/requireAdmin', () => ({
  requireAdmin: requireAdminMock,
  AdminAuthError: AdminAuthErrorMock,
}));
vi.mock('@/lib/subscriptions/repo', () => ({
  listSubscriptions: listSubscriptionsMock,
  createSubscription: createSubscriptionMock,
}));

import { GET, POST } from './route';

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/admin/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const goodTrialBody = {
  userPhone: '0901234567',
  type: 'trial',
  durationDays: 14,
};
const goodPaidBody = {
  userPhone: '0901234567',
  type: 'paid',
  durationDays: 30,
  paymentRef: 'PAY-1',
};

describe('GET /api/admin/subscriptions', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    listSubscriptionsMock.mockReset();
  });

  it('401 with no_cookie when AdminAuthError(no_cookie) is thrown', async () => {
    requireAdminMock.mockRejectedValueOnce(new AdminAuthErrorMock('no_cookie'));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'no_cookie' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(listSubscriptionsMock).not.toHaveBeenCalled();
  });

  it('401 with invalid_cookie', async () => {
    requireAdminMock.mockRejectedValueOnce(
      new AdminAuthErrorMock('invalid_cookie'),
    );
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_cookie' });
  });

  it('401 with not_allowlisted', async () => {
    requireAdminMock.mockRejectedValueOnce(
      new AdminAuthErrorMock('not_allowlisted'),
    );
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'not_allowlisted' });
  });

  it('200 + empty array when admin is valid and no records', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    listSubscriptionsMock.mockResolvedValueOnce([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('200 + records when admin is valid', async () => {
    const rows = [
      { id: '1', userPhone: '+84901234567' },
      { id: '2', userPhone: '+84902222222' },
    ];
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    listSubscriptionsMock.mockResolvedValueOnce(rows);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(rows);
  });

  it('propagates non-AdminAuthError errors', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('boom'));
    await expect(GET()).rejects.toThrow('boom');
  });
});

describe('POST /api/admin/subscriptions', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    createSubscriptionMock.mockReset();
  });

  it('401 with no_cookie', async () => {
    requireAdminMock.mockRejectedValueOnce(new AdminAuthErrorMock('no_cookie'));
    const res = await POST(postReq(goodTrialBody) as never);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'no_cookie' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('401 with invalid_cookie', async () => {
    requireAdminMock.mockRejectedValueOnce(
      new AdminAuthErrorMock('invalid_cookie'),
    );
    const res = await POST(postReq(goodTrialBody) as never);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_cookie' });
  });

  it('401 with not_allowlisted', async () => {
    requireAdminMock.mockRejectedValueOnce(
      new AdminAuthErrorMock('not_allowlisted'),
    );
    const res = await POST(postReq(goodTrialBody) as never);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'not_allowlisted' });
  });

  it('400 when body is not JSON', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    const res = await POST(postReq('not-json{') as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_input');
    expect(createSubscriptionMock).not.toHaveBeenCalled();
  });

  it('400 with fields.userPhone when missing', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    const res = await POST(
      postReq({ type: 'trial', durationDays: 14 }) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fields?.userPhone).toBeTruthy();
  });

  it('400 with fields.userPhone when in non-VN format', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    const res = await POST(
      postReq({
        userPhone: '+84901234567',
        type: 'trial',
        durationDays: 14,
      }) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fields?.userPhone).toContain('không hợp lệ');
  });

  it('400 with fields.userPhone for bare 9-digit', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    const res = await POST(
      postReq({
        userPhone: '901234567',
        type: 'trial',
        durationDays: 14,
      }) as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).fields?.userPhone).toBeTruthy();
  });

  it('400 with fields.paymentRef when trial has paymentRef', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    const res = await POST(
      postReq({ ...goodTrialBody, paymentRef: 'BAD' }) as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).fields?.paymentRef).toBeTruthy();
  });

  it('400 with fields.paymentRef when paid is missing it', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    const res = await POST(
      postReq({
        userPhone: '0901234567',
        type: 'paid',
        durationDays: 30,
      }) as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).fields?.paymentRef).toBeTruthy();
  });

  it('400 with fields.durationDays when 0/366/non-integer', async () => {
    requireAdminMock.mockResolvedValue({ uid: 'u', email: 'a@x.io' });

    const r1 = await POST(
      postReq({ ...goodTrialBody, durationDays: 0 }) as never,
    );
    expect(r1.status).toBe(400);
    expect((await r1.json()).fields?.durationDays).toBeTruthy();

    const r2 = await POST(
      postReq({ ...goodTrialBody, durationDays: 366 }) as never,
    );
    expect(r2.status).toBe(400);
    expect((await r2.json()).fields?.durationDays).toBeTruthy();

    const r3 = await POST(
      postReq({ ...goodTrialBody, durationDays: 1.5 }) as never,
    );
    expect(r3.status).toBe(400);
    expect((await r3.json()).fields?.durationDays).toBeTruthy();
  });

  it('201 trial happy path → returns id; phone normalised to +84', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'admin-1', email: 'a@x.io' });
    createSubscriptionMock.mockResolvedValueOnce({
      ok: true,
      id: 'trial-id',
    });

    const res = await POST(postReq(goodTrialBody) as never);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'trial-id' });
    expect(res.headers.get('cache-control')).toBe('no-store');

    const call = createSubscriptionMock.mock.calls[0][0];
    expect(call.userPhone).toBe('+84901234567');
    expect(call.type).toBe('trial');
    expect(call.paymentRef).toBeNull();
    expect(call.source).toBe('manual_admin');
    expect(call.createdBy).toBe('admin-1');
    expect(typeof call.startDate).toBe('number');
  });

  it('201 paid happy path → returns id; paymentRef forwarded', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    createSubscriptionMock.mockResolvedValueOnce({ ok: true, id: 'paid-id' });

    const res = await POST(postReq(goodPaidBody) as never);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'paid-id' });
    const call = createSubscriptionMock.mock.calls[0][0];
    expect(call.type).toBe('paid');
    expect(call.paymentRef).toBe('PAY-1');
  });

  it('passes through startDate when provided', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    createSubscriptionMock.mockResolvedValueOnce({ ok: true, id: 'x' });
    await POST(
      postReq({ ...goodTrialBody, startDate: 1_700_000_000_000 }) as never,
    );
    expect(createSubscriptionMock.mock.calls[0][0].startDate).toBe(
      1_700_000_000_000,
    );
  });

  it('409 with Vietnamese message on trial_already_claimed', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    createSubscriptionMock.mockResolvedValueOnce({
      ok: false,
      error: 'trial_already_claimed',
    });
    const res = await POST(postReq(goodTrialBody) as never);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('trial_already_claimed');
    expect(body.message).toContain('đã sử dụng dùng thử');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('500 with internal error on rtdb_write_failed', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    requireAdminMock.mockResolvedValueOnce({ uid: 'u', email: 'a@x.io' });
    createSubscriptionMock.mockResolvedValueOnce({
      ok: false,
      error: 'rtdb_write_failed',
      details: new Error('boom'),
    });
    const res = await POST(postReq(goodTrialBody) as never);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('internal');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
