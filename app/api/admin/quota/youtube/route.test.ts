import { describe, it, expect, vi, beforeEach } from 'vitest';

const { requireAdminMock, AdminAuthErrorMock, quotaOnceMock } = vi.hoisted(() => {
  class AdminAuthErrorMock extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.name = 'AdminAuthError';
      this.code = code;
    }
  }
  const quotaOnceMock = vi.fn();
  return { requireAdminMock: vi.fn(), AdminAuthErrorMock, quotaOnceMock };
});

vi.mock('@/features/admin/lib/requireAdmin', () => ({
  requireAdmin: requireAdminMock,
  AdminAuthError: AdminAuthErrorMock,
}));
vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn().mockReturnValue({
    ref: vi.fn().mockReturnValue({ once: quotaOnceMock }),
  }),
}));
vi.mock('@/features/admin/lib/firebaseAdmin', () => ({ getAdminApp: vi.fn() }));

import { GET } from './route';

function makeSnap(val: unknown) {
  return { val: () => val };
}

describe('GET /api/admin/quota/youtube', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    quotaOnceMock.mockReset();
  });

  it('401 when not authenticated', async () => {
    requireAdminMock.mockRejectedValueOnce(new AdminAuthErrorMock('no_cookie'));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ error: 'no_cookie' });
  });

  it('returns 30 day entries sorted oldest to newest', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    quotaOnceMock.mockResolvedValueOnce(makeSnap(null));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toHaveLength(30);
    expect(body.days[0].date < body.days[29].date).toBe(true);
    expect(body.dailyLimitCalls).toBe(100);
  });

  it('fills in calls from RTDB for matching date keys', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });

    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })
      .format(new Date())
      .replace(/-/g, '');
    quotaOnceMock.mockResolvedValueOnce(makeSnap({ [todayKey]: { calls: 42 } }));

    const res = await GET();
    const body = await res.json();
    const today = body.days.find((d: { date: string }) => d.date === todayKey);
    expect(today).toBeDefined();
    expect(today.calls).toBe(42);
  });

  it('returns calls: 0 for days with no data', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    quotaOnceMock.mockResolvedValueOnce(makeSnap({}));

    const res = await GET();
    const body = await res.json();
    expect(body.days.every((d: { calls: number }) => d.calls === 0)).toBe(true);
  });

  it('500 when RTDB throws', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    quotaOnceMock.mockRejectedValueOnce(new Error('network'));

    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'internal' });
  });
});
