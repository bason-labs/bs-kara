import { describe, it, expect, vi, beforeEach } from 'vitest';

const { requireAdminMock, AdminAuthErrorMock, onceMock } = vi.hoisted(() => {
  class AdminAuthErrorMock extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.name = 'AdminAuthError';
      this.code = code;
    }
  }
  const onceM = vi.fn();
  return { requireAdminMock: vi.fn(), AdminAuthErrorMock, onceMock: onceM };
});

vi.mock('@/features/admin/lib/requireAdmin', () => ({
  requireAdmin: requireAdminMock,
  AdminAuthError: AdminAuthErrorMock,
}));

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn().mockReturnValue({
    ref: vi.fn().mockReturnValue({
      orderByChild: vi.fn().mockReturnValue({
        limitToLast: vi.fn().mockReturnValue({ once: onceMock }),
      }),
    }),
  }),
}));
vi.mock('@/features/admin/lib/firebaseAdmin', () => ({ getAdminApp: vi.fn() }));

import { GET } from './route';

function makeSnap(val: unknown) { return { val: () => val }; }

const twoSessions = {
  'sess-a': { ip: '1.2.3.4', userAgent: 'Mozilla', deviceType: 'mobile', roomId: '1234', joinedAt: 2000, leftAt: 3000 },
  'sess-b': { ip: '5.6.7.8', userAgent: 'Chrome', deviceType: 'desktop', roomId: '5678', joinedAt: 1000, leftAt: null },
};

describe('GET /api/admin/sessions', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    onceMock.mockReset();
  });

  it('401 when not authenticated', async () => {
    requireAdminMock.mockRejectedValueOnce(new AdminAuthErrorMock('no_cookie'));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'no_cookie' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('returns sessions array sorted newest-first', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    onceMock.mockResolvedValueOnce(makeSnap(twoSessions));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toHaveLength(2);
    expect(body.sessions[0].joinedAt).toBeGreaterThan(body.sessions[1].joinedAt);
  });

  it('includes sessionId in each record', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    onceMock.mockResolvedValueOnce(makeSnap(twoSessions));
    const res = await GET();
    const body = await res.json();
    const ids = body.sessions.map((s: { sessionId: string }) => s.sessionId);
    expect(ids).toContain('sess-a');
    expect(ids).toContain('sess-b');
  });

  it('returns empty sessions array when no data', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    onceMock.mockResolvedValueOnce(makeSnap(null));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toEqual([]);
  });

  it('500 when RTDB throws', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    onceMock.mockRejectedValueOnce(new Error('RTDB offline'));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'internal' });
  });
});
