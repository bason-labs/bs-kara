import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';
import {
  ADMIN_SESSION_COOKIE,
  isAllowlistedEmail,
} from '@/features/admin/lib/requireAdmin';

// 5 days, matching Firebase Auth's session cookie max.
const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000;

interface SessionBody {
  idToken?: unknown;
}

export async function POST(req: NextRequest) {
  let body: SessionBody = {};
  try {
    body = (await req.json()) as SessionBody;
  } catch {
    // fall through to validation
  }

  const idToken = typeof body.idToken === 'string' ? body.idToken : '';
  if (!idToken) {
    return NextResponse.json(
      { error: 'missing_id_token' },
      { status: 400 },
    );
  }

  const auth = getAuth(getAdminApp());

  // Verify the ID token first so we can reject non-allowlisted emails BEFORE
  // minting a privileged session cookie.
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: 'invalid_id_token' }, { status: 401 });
  }

  if (!isAllowlistedEmail(decoded.email)) {
    return NextResponse.json({ error: 'not_allowlisted' }, { status: 403 });
  }

  let sessionCookie;
  try {
    sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_TTL_MS,
    });
  } catch {
    return NextResponse.json({ error: 'session_mint_failed' }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(ADMIN_SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
