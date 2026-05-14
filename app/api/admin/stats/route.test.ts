import { describe, it, expect, vi, beforeEach } from 'vitest';

const { requireAdminMock, AdminAuthErrorMock, roomsOnceMock } = vi.hoisted(() => {
  class AdminAuthErrorMock extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.name = 'AdminAuthError';
      this.code = code;
    }
  }
  const roomsOnceMock = vi.fn();
  return {
    requireAdminMock: vi.fn(),
    AdminAuthErrorMock,
    roomsOnceMock,
  };
});

vi.mock('@/features/admin/lib/requireAdmin', () => ({
  requireAdmin: requireAdminMock,
  AdminAuthError: AdminAuthErrorMock,
}));
vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn().mockReturnValue({
    ref: vi.fn().mockReturnValue({ once: roomsOnceMock }),
  }),
}));
vi.mock('@/features/admin/lib/firebaseAdmin', () => ({ getAdminApp: vi.fn() }));

import { GET } from './route';

function makeSnap(val: unknown) {
  return { val: () => val, exists: () => val !== null };
}

const twoRooms = {
  '1234': {
    isTvActive: true,
    queue: { '-Nabc': { id: 'v1', title: 'Song A' }, '-Ndef': { id: 'v2', title: 'Song B' } },
    currentPlaying: { title: 'Song A' },
    lastEndedAt: null,
  },
  '5678': {
    isTvActive: false,
    queue: {},
    currentPlaying: null,
    lastEndedAt: 1_700_000_000_000,
  },
};

describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    roomsOnceMock.mockReset();
  });

  it('401 when requireAdmin throws no_cookie', async () => {
    requireAdminMock.mockRejectedValueOnce(new AdminAuthErrorMock('no_cookie'));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'no_cookie' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('returns correct KPIs for two rooms', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    roomsOnceMock.mockResolvedValueOnce(makeSnap(twoRooms));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalRooms).toBe(2);
    expect(body.activeTvRooms).toBe(1);
    expect(body.totalQueueDepth).toBe(2);
  });

  it('returns per-room rows with correct fields', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    roomsOnceMock.mockResolvedValueOnce(makeSnap(twoRooms));

    const res = await GET();
    const body = await res.json();
    const room1234 = body.rooms.find((r: { roomId: string }) => r.roomId === '1234');
    expect(room1234).toMatchObject({
      roomId: '1234',
      queueDepth: 2,
      hasTv: true,
      currentSong: 'Song A',
      lastEndedAt: null,
    });
    const room5678 = body.rooms.find((r: { roomId: string }) => r.roomId === '5678');
    expect(room5678).toMatchObject({
      roomId: '5678',
      queueDepth: 0,
      hasTv: false,
      currentSong: null,
      lastEndedAt: 1_700_000_000_000,
    });
  });

  it('returns empty KPIs when rooms node is null', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    roomsOnceMock.mockResolvedValueOnce(makeSnap(null));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalRooms).toBe(0);
    expect(body.rooms).toEqual([]);
  });

  it('500 when RTDB throws', async () => {
    requireAdminMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.com' });
    roomsOnceMock.mockRejectedValueOnce(new Error('RTDB offline'));

    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'internal' });
  });
});
