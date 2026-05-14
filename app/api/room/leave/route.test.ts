import { describe, it, expect, vi, beforeEach } from 'vitest';

const { setMock, refMock, dbMock, getAdminAppMock } = vi.hoisted(() => {
  const setMock = vi.fn().mockResolvedValue(undefined);
  const refMock = vi.fn().mockReturnValue({ set: setMock });
  const dbMock = vi.fn().mockReturnValue({ ref: refMock });
  const getAdminAppMock = vi.fn().mockReturnValue({});
  return { setMock, refMock, dbMock, getAdminAppMock };
});

vi.mock('firebase-admin/database', () => ({ getDatabase: dbMock }));
vi.mock('@/features/admin/lib/firebaseAdmin', () => ({ getAdminApp: getAdminAppMock }));

import { POST } from './route';
import { NextRequest } from 'next/server';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/room/leave', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/room/leave', () => {
  beforeEach(() => {
    setMock.mockReset().mockResolvedValue(undefined);
    refMock.mockReset().mockReturnValue({ set: setMock });
    dbMock.mockReset().mockReturnValue({ ref: refMock });
    getAdminAppMock.mockReset().mockReturnValue({});
  });

  it('400 when sessionId is missing', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'missing_session_id' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('400 when sessionId is empty string', async () => {
    const res = await POST(makeReq({ sessionId: '   ' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'missing_session_id' });
  });

  it('400 when sessionId contains path-injection characters', async () => {
    const res = await POST(makeReq({ sessionId: 'abc/../secret' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_session_id' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('200 and ok:true on success', async () => {
    const res = await POST(makeReq({ sessionId: 'session-abc' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('writes leftAt timestamp to correct RTDB path', async () => {
    const before = Date.now();
    await POST(makeReq({ sessionId: 'session-abc' }));
    expect(refMock).toHaveBeenCalledWith('analytics/sessions/session-abc/leftAt');
    const writtenTs = setMock.mock.calls[0][0] as number;
    expect(writtenTs).toBeGreaterThanOrEqual(before);
    expect(writtenTs).toBeLessThanOrEqual(Date.now());
  });

  it('500 when RTDB set throws', async () => {
    setMock.mockRejectedValueOnce(new Error('RTDB down'));
    const res = await POST(makeReq({ sessionId: 'session-abc' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'internal' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
