import { describe, it, expect, vi, beforeEach } from 'vitest';

const { requireAdminMock, AdminAuthErrorMock, searchOnceMock } = vi.hoisted(() => {
  class AdminAuthErrorMock extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.name = 'AdminAuthError';
      this.code = code;
    }
  }
  const searchOnceMock = vi.fn();
  return { requireAdminMock: vi.fn(), AdminAuthErrorMock, searchOnceMock };
});

vi.mock('@/features/admin/lib/requireAdmin', () => ({
  requireAdmin: requireAdminMock,
  AdminAuthError: AdminAuthErrorMock,
}));
vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn().mockReturnValue({
    ref: vi.fn().mockReturnValue({ once: searchOnceMock }),
  }),
}));
vi.mock('@/features/admin/lib/firebaseAdmin', () => ({ getAdminApp: vi.fn() }));

import { GET } from './route';

function makeSnap(val: unknown) {
  return { val: () => val };
}

describe('GET /api/admin/search-stats', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    searchOnceMock.mockReset();
  });

  it('401 when not authenticated', async () => {
    requireAdminMock.mockRejectedValueOnce(new AdminAuthErrorMock('no_cookie'));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ error: 'no_cookie' });
  });

  it('returns exactly 30 days sorted oldest to newest', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    searchOnceMock.mockResolvedValueOnce(makeSnap(null));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toHaveLength(30);
    expect(body.days[0].date < body.days[29].date).toBe(true);
  });

  it('computes cached = total - live for matching days', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })
      .format(new Date())
      .replace(/-/g, '');
    searchOnceMock.mockResolvedValueOnce(makeSnap({ [todayKey]: { total: 10, live: 3 } }));
    const res = await GET();
    const body = await res.json();
    const today = body.days.find((d: { date: string }) => d.date === todayKey);
    expect(today.total).toBe(10);
    expect(today.live).toBe(3);
    expect(today.cached).toBe(7);
  });

  it('clamps cached to 0 when live > total (data anomaly)', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })
      .format(new Date())
      .replace(/-/g, '');
    searchOnceMock.mockResolvedValueOnce(makeSnap({ [todayKey]: { total: 2, live: 5 } }));
    const res = await GET();
    const body = await res.json();
    const today = body.days.find((d: { date: string }) => d.date === todayKey);
    expect(today.cached).toBe(0);
  });

  it('zero-fills days with no data', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    searchOnceMock.mockResolvedValueOnce(makeSnap({}));
    const res = await GET();
    const body = await res.json();
    expect(body.days.every((d: { total: number; live: number; cached: number }) =>
      d.total === 0 && d.live === 0 && d.cached === 0)).toBe(true);
  });

  it('500 when RTDB throws', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    searchOnceMock.mockRejectedValueOnce(new Error('network'));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'internal' });
  });
});
