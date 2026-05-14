import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/features/admin/lib/requireAdmin', () => {
  class AdminAuthError extends Error {
    code: string;
    constructor(code: string) { super(code); this.name = 'AdminAuthError'; this.code = code; }
  }
  return { requireAdmin: vi.fn(), AdminAuthError };
});

vi.mock('firebase-admin/database', () => {
  const onceMock = vi.fn();
  return {
    getDatabase: vi.fn(() => ({
      ref: vi.fn(() => ({ once: onceMock })),
    })),
    __onceMock: onceMock,
  };
});

vi.mock('@/features/admin/lib/firebaseAdmin', () => ({ getAdminApp: vi.fn() }));

import { GET } from './route';
import { requireAdmin, AdminAuthError } from '@/features/admin/lib/requireAdmin';
import { getDatabase } from 'firebase-admin/database';

const requireAdminMock = requireAdmin as ReturnType<typeof vi.fn>;
const getDatabaseMock = getDatabase as ReturnType<typeof vi.fn>;

function makeSnap(val: unknown) { return { val: () => val }; }

const rtdbQueueOps = {
  '1234': {
    '20260101': { adds: 5, removes: 2 },
    '20260102': { adds: 3, removes: 1 },
  },
  '5678': {
    '20260101': { adds: 10 },
  },
};

describe('GET /api/admin/queue-ops', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    getDatabaseMock.mockReset();
    vi.clearAllMocks();
  });

  it('401 when not authenticated', async () => {
    requireAdminMock.mockRejectedValueOnce(new (AdminAuthError as unknown as new (code: string) => Error)('no_cookie'));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'no_cookie' });
  });

  it('aggregates adds/removes per room across all dates', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    const onceMock = vi.fn().mockResolvedValueOnce(makeSnap(rtdbQueueOps));
    getDatabaseMock.mockReturnValueOnce({
      ref: vi.fn().mockReturnValueOnce({ once: onceMock }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const room1234 = body.rooms.find((r: { roomId: string }) => r.roomId === '1234');
    expect(room1234).toMatchObject({ roomId: '1234', adds: 8, removes: 3 });
    const room5678 = body.rooms.find((r: { roomId: string }) => r.roomId === '5678');
    expect(room5678).toMatchObject({ roomId: '5678', adds: 10, removes: 0 });
  });

  it('computes correct grand totals', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    const onceMock = vi.fn().mockResolvedValueOnce(makeSnap(rtdbQueueOps));
    getDatabaseMock.mockReturnValueOnce({
      ref: vi.fn().mockReturnValueOnce({ once: onceMock }),
    });
    const res = await GET();
    const body = await res.json();
    expect(body.totalAdds).toBe(18);
    expect(body.totalRemoves).toBe(3);
  });

  it('returns empty rooms array when no data', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    const onceMock = vi.fn().mockResolvedValueOnce(makeSnap(null));
    getDatabaseMock.mockReturnValueOnce({
      ref: vi.fn().mockReturnValueOnce({ once: onceMock }),
    });
    const res = await GET();
    const body = await res.json();
    expect(body.rooms).toEqual([]);
    expect(body.totalAdds).toBe(0);
    expect(body.totalRemoves).toBe(0);
  });

  it('500 when RTDB throws', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    const onceMock = vi.fn().mockRejectedValueOnce(new Error('network'));
    getDatabaseMock.mockReturnValueOnce({
      ref: vi.fn().mockReturnValueOnce({ once: onceMock }),
    });
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'internal' });
  });
});
