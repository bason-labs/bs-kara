'use client';

import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';

// We reuse the same Firebase config that lib/firebase.ts uses for RTDB, but
// initialise a separate app instance so adding Auth here doesn't disturb the
// existing RTDB singleton or its consumers. Both apps point at the same
// project, which is what Auth needs anyway.
const ADMIN_AUTH_APP = 'bs-kara-admin-auth';

function getAuthApp() {
  const existing = getApps().find((a) => a.name === ADMIN_AUTH_APP);
  if (existing) return existing;
  return initializeApp(
    {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    },
    ADMIN_AUTH_APP,
  );
}

export type AdminSignInError =
  | 'invalid_credentials'
  | 'not_allowlisted'
  | 'network_error'
  | 'unknown';

export async function adminSignIn(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: AdminSignInError }> {
  const auth = getAuth(getAuthApp());

  let idToken: string;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    idToken = await cred.user.getIdToken();
  } catch {
    return { ok: false, error: 'invalid_credentials' };
  }

  let res: Response;
  try {
    res = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    return { ok: false, error: 'network_error' };
  }

  if (res.status === 403) return { ok: false, error: 'not_allowlisted' };
  if (!res.ok) return { ok: false, error: 'unknown' };
  return { ok: true };
}

export async function adminSignOut(): Promise<void> {
  try {
    await fetch('/api/admin/session', { method: 'DELETE' });
  } catch {
    // best-effort: even if the request fails, sign out the client-side auth
    // so a subsequent page load starts from a clean state.
  }
  try {
    await signOut(getAuth(getAuthApp()));
  } catch {
    // ignore
  }
}
