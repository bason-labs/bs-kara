import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const cookiesGet = vi.fn<(name: string) => { value: string } | undefined>();
const verifySessionCookie = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookiesGet }),
}));
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifySessionCookie }),
}));
vi.mock('./firebaseAdmin', () => ({
  getAdminApp: () => ({}),
}));

import {
  requireAdmin,
  AdminAuthError,
  parseAdminEmails,
  isAllowlistedEmail,
  ADMIN_SESSION_COOKIE,
} from './requireAdmin';

describe('parseAdminEmails', () => {
  it('returns empty set for undefined/empty', () => {
    expect(parseAdminEmails(undefined).size).toBe(0);
    expect(parseAdminEmails('').size).toBe(0);
    expect(parseAdminEmails('   ').size).toBe(0);
  });

  it('trims whitespace and lowercases', () => {
    const s = parseAdminEmails('  Foo@Example.com , bar@x.io  ');
    expect(s.has('foo@example.com')).toBe(true);
    expect(s.has('bar@x.io')).toBe(true);
    expect(s.size).toBe(2);
  });

  it('skips blank entries', () => {
    const s = parseAdminEmails('a@x,,b@x,');
    expect(s.size).toBe(2);
  });
});

describe('isAllowlistedEmail', () => {
  const originalEnv = process.env.ADMIN_EMAILS;
  afterEach(() => {
    process.env.ADMIN_EMAILS = originalEnv;
  });

  it('matches case-insensitively', () => {
    process.env.ADMIN_EMAILS = 'admin@x.io,Other@Y.io';
    expect(isAllowlistedEmail('ADMIN@x.io')).toBe(true);
    expect(isAllowlistedEmail('other@y.io')).toBe(true);
    expect(isAllowlistedEmail('nobody@z.io')).toBe(false);
  });

  it('returns false for null/empty email or empty env', () => {
    process.env.ADMIN_EMAILS = '';
    expect(isAllowlistedEmail('admin@x.io')).toBe(false);
    process.env.ADMIN_EMAILS = 'admin@x.io';
    expect(isAllowlistedEmail(null)).toBe(false);
    expect(isAllowlistedEmail(undefined)).toBe(false);
    expect(isAllowlistedEmail('')).toBe(false);
  });
});

describe('requireAdmin', () => {
  const originalEnv = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    cookiesGet.mockReset();
    verifySessionCookie.mockReset();
    process.env.ADMIN_EMAILS = 'admin@x.io';
  });
  afterEach(() => {
    process.env.ADMIN_EMAILS = originalEnv;
  });

  it('throws no_cookie when session cookie absent', async () => {
    cookiesGet.mockReturnValue(undefined);
    await expect(requireAdmin()).rejects.toMatchObject({
      name: 'AdminAuthError',
      code: 'no_cookie',
    });
    expect(cookiesGet).toHaveBeenCalledWith(ADMIN_SESSION_COOKIE);
  });

  it('throws invalid_cookie when verifySessionCookie rejects', async () => {
    cookiesGet.mockReturnValue({ value: 'bad-cookie' });
    verifySessionCookie.mockRejectedValue(new Error('expired'));
    const err = await requireAdmin().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdminAuthError);
    expect((err as AdminAuthError).code).toBe('invalid_cookie');
  });

  it('throws not_allowlisted when verified email not in env list', async () => {
    cookiesGet.mockReturnValue({ value: 'good' });
    verifySessionCookie.mockResolvedValue({
      uid: 'uid-1',
      email: 'someone-else@y.io',
    });
    await expect(requireAdmin()).rejects.toMatchObject({
      code: 'not_allowlisted',
    });
  });

  it('returns principal when cookie + allowlist both valid', async () => {
    cookiesGet.mockReturnValue({ value: 'good' });
    verifySessionCookie.mockResolvedValue({
      uid: 'uid-1',
      email: 'admin@x.io',
    });
    await expect(requireAdmin()).resolves.toEqual({
      uid: 'uid-1',
      email: 'admin@x.io',
    });
    // verifySessionCookie called with checkRevoked=true
    expect(verifySessionCookie).toHaveBeenCalledWith('good', true);
  });
});
