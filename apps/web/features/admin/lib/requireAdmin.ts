import 'server-only';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from './firebaseAdmin';

export const ADMIN_SESSION_COOKIE = '__session';

export class AdminAuthError extends Error {
  code: 'no_cookie' | 'invalid_cookie' | 'not_allowlisted';
  constructor(code: 'no_cookie' | 'invalid_cookie' | 'not_allowlisted') {
    super(`AdminAuthError: ${code}`);
    this.name = 'AdminAuthError';
    this.code = code;
  }
}

// Reads ADMIN_EMAILS env (comma-separated, trimmed, case-insensitive).
// Returns a Set of lowercased emails. Empty Set when env is absent or blank.
export function parseAdminEmails(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  const out = new Set<string>();
  for (const part of raw.split(',')) {
    const e = part.trim().toLowerCase();
    if (e) out.add(e);
  }
  return out;
}

export function isAllowlistedEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const list = parseAdminEmails(process.env.ADMIN_EMAILS);
  return list.has(email.toLowerCase());
}

export interface AdminPrincipal {
  uid: string;
  email: string;
}

// Server-only gate. Used by `app/admin/layout.tsx` and every admin route
// handler. Throws AdminAuthError on any failure — caller chooses how to
// react (redirect for layout, 401/403 for API).
export async function requireAdmin(): Promise<AdminPrincipal> {
  const jar = await cookies();
  const cookie = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!cookie) throw new AdminAuthError('no_cookie');

  let decoded;
  try {
    decoded = await getAuth(getAdminApp()).verifySessionCookie(cookie, true);
  } catch {
    throw new AdminAuthError('invalid_cookie');
  }

  if (!isAllowlistedEmail(decoded.email)) {
    throw new AdminAuthError('not_allowlisted');
  }
  return { uid: decoded.uid, email: decoded.email as string };
}
