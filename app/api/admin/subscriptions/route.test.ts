import { describe, it, expect, vi, beforeEach } from 'vitest';

const { requireAdminMock, listSubscriptionsMock, AdminAuthErrorMock } =
  vi.hoisted(() => {
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
      AdminAuthErrorMock,
    };
  });

vi.mock('@/features/admin/lib/requireAdmin', () => ({
  requireAdmin: requireAdminMock,
  AdminAuthError: AdminAuthErrorMock,
}));
vi.mock('@/lib/subscriptions/repo', () => ({
  listSubscriptions: listSubscriptionsMock,
}));

import { GET } from './route';

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
