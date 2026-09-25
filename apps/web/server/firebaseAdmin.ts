import {
  cert,
  deleteApp,
  getApp,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';

const APP_NAME = 'bs-kara-admin';

// Idempotent singleton — Next.js dev hot-reloads the route handler module,
// and firebase-admin throws if the same named app is initialised twice. The
// getApps lookup keeps us a single canonical instance per process.
export function getAdminApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      'firebase-admin not configured: set FIREBASE_ADMIN_PROJECT_ID, ' +
        'FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY',
    );
  }

  // Vercel stores multi-line private keys with literal "\n". Convert back to
  // real newlines so the PEM parser sees a valid block.
  const privateKey = rawKey.replace(/\\n/g, '\n');

  return initializeApp(
    {
      credential: cert({ projectId, clientEmail, privateKey }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    },
    APP_NAME,
  );
}

// Test seam — exported so unit tests can reset the cached app between cases.
// Production code should never call this.
export function __resetAdminAppForTests() {
  try {
    const app = getApp(APP_NAME);
    void deleteApp(app);
  } catch {
    // no-op: app was not initialised
  }
}
