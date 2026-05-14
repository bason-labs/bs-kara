import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pushMock, sessionRefMock, dbMock, getAdminAppMock } = vi.hoisted(() => {
  const pushMock = vi.fn().mockResolvedValue({ key: 'session-abc' });
  const sessionRefMock = vi.fn().mockReturnValue({ push: pushMock });
  const dbMock = vi.fn().mockReturnValue({ ref: sessionRefMock });
  const getAdminAppMock = vi.fn().mockReturnValue({});
  return { pushMock, sessionRefMock, dbMock, getAdminAppMock };
});

vi.mock('firebase-admin/database', () => ({ getDatabase: dbMock }));
vi.mock('@/features/admin/lib/firebaseAdmin', () => ({ getAdminApp: getAdminAppMock }));

import { POST } from './route';
import { NextRequest } from 'next/server';

function makeReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/room/join', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('POST /api/room/join', () => {
  beforeEach(() => {
    pushMock.mockReset().mockResolvedValue({ key: 'session-abc' });
    sessionRefMock.mockReset().mockReturnValue({ push: pushMock });
  });

  it('400 when roomId is missing', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'missing_room_id' });
  });

  it('400 when roomId is empty string', async () => {
    const res = await POST(makeReq({ roomId: '  ' }));
    expect(res.status).toBe(400);
  });

  it('200 returns sessionId on success', async () => {
    const res = await POST(makeReq({ roomId: '1234' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ sessionId: 'session-abc' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('writes correct session data to RTDB analytics/sessions', async () => {
    await POST(makeReq({ roomId: '1234' }, { 'user-agent': 'Mozilla/5.0 (iPhone; ...) Mobile', 'x-forwarded-for': '192.0.2.1, 10.0.0.1' }));
    expect(sessionRefMock).toHaveBeenCalledWith('analytics/sessions');
    const written = pushMock.mock.calls[0][0] as Record<string, unknown>;
    expect(written.roomId).toBe('1234');
    expect(written.deviceType).toBe('mobile');
    expect(typeof written.joinedAt).toBe('number');
    expect(written.leftAt).toBeNull();
    expect(written.ip).toBe('192.0.2.1');
  });

  it('detects desktop from user-agent without Mobi/Android', async () => {
    await POST(makeReq({ roomId: '1234' }, { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64)' }));
    const written = pushMock.mock.calls[0][0] as Record<string, unknown>;
    expect(written.deviceType).toBe('desktop');
  });

  it('ip falls back to "unknown" when x-forwarded-for is absent', async () => {
    await POST(makeReq({ roomId: '1234' }));
    const written = pushMock.mock.calls[0][0] as Record<string, unknown>;
    expect(written.ip).toBe('unknown');
  });

  it('500 when RTDB push throws', async () => {
    pushMock.mockRejectedValueOnce(new Error('RTDB down'));
    const res = await POST(makeReq({ roomId: '1234' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'internal' });
  });
});
