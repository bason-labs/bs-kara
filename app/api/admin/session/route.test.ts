import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const verifyIdToken = vi.fn();
const createSessionCookie = vi.fn();

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken, createSessionCookie }),
}));
vi.mock('@/features/admin/lib/firebaseAdmin', () => ({
  getAdminApp: () => ({}),
}));

import { POST, DELETE } from './route';

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/admin/session', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/admin/session', () => {
  const originalEnv = process.env.ADMIN_EMAILS;
  beforeEach(() => {
    verifyIdToken.mockReset();
    createSessionCookie.mockReset();
    process.env.ADMIN_EMAILS = 'admin@x.io';
  });
  afterEach(() => {
    process.env.ADMIN_EMAILS = originalEnv;
  });

  it('400 when idToken missing', async () => {
    const res = await POST(makeReq({}) as never);
    expect(res.status).toBe(400);
  });

  it('400 when body is malformed JSON', async () => {
    const res = await POST(makeReq('not-json{') as never);
    expect(res.status).toBe(400);
  });

  it('401 when verifyIdToken rejects', async () => {
    verifyIdToken.mockRejectedValueOnce(new Error('bad token'));
    const res = await POST(makeReq({ idToken: 'whatever' }) as never);
    expect(res.status).toBe(401);
  });

  it('403 when email not in allowlist', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'other@y.io' });
    const res = await POST(makeReq({ idToken: 'tok' }) as never);
    expect(res.status).toBe(403);
    expect(createSessionCookie).not.toHaveBeenCalled();
  });

  it('200 + sets __session cookie on success', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'admin@x.io' });
    createSessionCookie.mockResolvedValue('mock-session-cookie-value');
    const res = await POST(makeReq({ idToken: 'tok' }) as never);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('__session=mock-session-cookie-value');
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
  });
});

describe('DELETE /api/admin/session', () => {
  it('clears cookie and returns 200', async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('__session=');
    expect(setCookie.toLowerCase()).toContain('max-age=0');
  });
});
