import 'server-only';
import { getDatabase } from 'firebase-admin/database';
import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';
import {
  SubscriptionRecordSchema,
  type SubscriptionRecord,
} from './schema';
import { subscriptionPath, subscriptionsRoot } from './paths';

// Read-only RTDB repo for Commit 2. createSubscription and
// cancelSubscription land in Commits 3 and 4 — keep this surface tight so
// the write path is added in one place and not scattered.
//
// All access goes through firebase-admin (server SDK) so the route handler
// runs with project-admin credentials and bypasses client-side RTDB rules.
// Hooks / API routes call these functions; the SDK is never imported from
// outside this file.

function adminDb() {
  return getDatabase(getAdminApp());
}

function parseRow(
  raw: unknown,
  id: string,
): SubscriptionRecord | null {
  // The record may have been written before the schema landed, or by a
  // future schema version. Drop malformed rows instead of crashing the
  // whole list — admins still get to see the rest.
  const candidate =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { id, ...(raw as Record<string, unknown>) }
      : null;
  if (!candidate) {
    console.warn(`[subscriptions.repo] malformed row at id=${id}: not an object`);
    return null;
  }
  const parsed = SubscriptionRecordSchema.safeParse(candidate);
  if (!parsed.success) {
    console.warn(
      `[subscriptions.repo] malformed row at id=${id}:`,
      parsed.error.flatten(),
    );
    return null;
  }
  return parsed.data;
}

export async function listSubscriptions(): Promise<SubscriptionRecord[]> {
  const snap = await adminDb().ref(subscriptionsRoot()).once('value');
  const val = snap.val();
  if (!val || typeof val !== 'object') return [];

  const out: SubscriptionRecord[] = [];
  for (const [id, raw] of Object.entries(val as Record<string, unknown>)) {
    const row = parseRow(raw, id);
    if (row) out.push(row);
  }
  return out;
}

export async function getSubscription(
  id: string,
): Promise<SubscriptionRecord | null> {
  if (!id) return null;
  const snap = await adminDb().ref(subscriptionPath(id)).once('value');
  if (!snap.exists()) return null;
  return parseRow(snap.val(), id);
}
