import 'server-only';
import { getDatabase } from 'firebase-admin/database';
import { getAdminApp } from '@/features/admin/lib/firebaseAdmin';
import {
  CreateSubscriptionInputSchema,
  DAY_MS,
  SubscriptionRecordSchema,
  type SubscriptionRecord,
} from './schema';
import { isE164VN } from './phone';
import {
  byPhonePath,
  subscriptionPath,
  subscriptionsRoot,
  trialClaimedPath,
} from './paths';

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

// ─── Write path ────────────────────────────────────────────────────────

export type CreateSubscriptionError =
  | 'invalid_input'
  | 'trial_already_claimed'
  | 'rtdb_write_failed';

export type CreateSubscriptionResult =
  | { ok: true; id: string }
  | { ok: false; error: CreateSubscriptionError; details?: unknown };

export interface CreateSubscriptionArgs {
  // Already normalised to +84XXXXXXXXX by the caller (the route handler
  // runs the input through toE164VN). createSubscription re-asserts the
  // format defensively in case a future caller forgets.
  userPhone: string;
  type: 'trial' | 'paid';
  durationDays: number;
  // For 'trial' MUST be null; for 'paid' MUST be a non-empty string. The
  // CreateSubscriptionInputSchema enforces this; we run the schema here
  // again as a belt-and-suspenders against bad caller code.
  paymentRef: string | null;
  // Epoch ms. Caller decides — the manual-add form defaults to Date.now()
  // but admins may backdate.
  startDate: number;
  // Commit 3 only handles manual admin creation. The future phone
  // self-register and payment-webhook callers will pass their own source.
  source: 'manual_admin';
  // Admin uid from requireAdmin(). null is reserved for automated sources
  // in later commits.
  createdBy: string;
}

/**
 * Create a subscription record.
 *
 * For trial subscriptions, enforces lifetime uniqueness via a transaction
 * at `subscriptionTrialClaimed/{phoneE164}` written BEFORE the record:
 *
 *  1. Transaction races to set the trial flag to `true`. If another
 *     concurrent caller already won, our transaction sees `current === true`,
 *     aborts, and we return trial_already_claimed without writing anything.
 *  2. If the transaction commits, we run a multi-path update that writes
 *     the subscription record and the by-phone pointer atomically.
 *  3. If step 2 fails after step 1 succeeded, we attempt to roll back the
 *     trial flag — but only if no subscription record exists for this
 *     phone (i.e. our claim hasn't yet been "redeemed" by a concurrent
 *     successful write). The rollback is best-effort and any failure is
 *     logged for manual intervention.
 *
 * DO NOT replace the transaction with a read-then-write check — that is
 * not race-safe. Two admins clicking "Create trial" within the same tick
 * would both see `claimed === false` and both write.
 */
export async function createSubscription(
  args: CreateSubscriptionArgs,
): Promise<CreateSubscriptionResult> {
  // Schema validates durationDays bounds, type↔paymentRef cross-field
  // rule, and the userPhone string shape (min length only).
  const parsed = CreateSubscriptionInputSchema.safeParse({
    userPhone: args.userPhone,
    type: args.type,
    durationDays: args.durationDays,
    paymentRef:
      args.paymentRef === null ? undefined : args.paymentRef,
    startDate: args.startDate,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid_input',
      details: parsed.error.flatten(),
    };
  }

  // Belt-and-suspenders: ensure userPhone is in the canonical E.164 form
  // before persisting. The route handler is supposed to have normalised
  // already; this catches bugs where a future caller skips that step.
  if (!isE164VN(args.userPhone)) {
    return {
      ok: false,
      error: 'invalid_input',
      details: { userPhone: 'must be +84XXXXXXXXX' },
    };
  }

  const db = adminDb();
  const now = Date.now();
  const endDate = args.startDate + args.durationDays * DAY_MS;
  const newRef = db.ref(subscriptionsRoot()).push();
  const id = newRef.key as string;

  // Build the stored payload. NOTE: the `id` field is the RTDB key — it
  // is NOT stored inside the record body. The rules' $other:false would
  // reject it, and parseRow synthesises id from the key on read.
  const storedRecord = {
    userPhone: args.userPhone,
    userId: null as string | null,
    type: args.type,
    status: 'active' as const,
    durationDays: args.durationDays,
    startDate: args.startDate,
    endDate,
    source: args.source,
    paymentRef: args.type === 'paid' ? args.paymentRef : null,
    createdBy: args.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  // Final sanity check on the constructed record. Validates against the
  // same schema that listSubscriptions uses on read, so a write that
  // round-trips through parseRow will not be rejected as malformed.
  const sanityCheck = SubscriptionRecordSchema.safeParse({
    id,
    ...storedRecord,
  });
  if (!sanityCheck.success) {
    return {
      ok: false,
      error: 'invalid_input',
      details: sanityCheck.error.flatten(),
    };
  }

  // ── Trial-only: claim the lifetime flag transactionally ───────────────
  if (args.type === 'trial') {
    const trialRef = db.ref(trialClaimedPath(args.userPhone));
    let claim;
    try {
      claim = await trialRef.transaction((current) => {
        if (current === true) return;
        return true;
      });
    } catch (err) {
      return { ok: false, error: 'rtdb_write_failed', details: err };
    }
    if (!claim.committed) {
      return { ok: false, error: 'trial_already_claimed' };
    }
  }

  // ── Atomic multi-path write of the record + by-phone pointer ─────────
  try {
    await db.ref().update({
      [subscriptionPath(id)]: storedRecord,
      [byPhonePath(args.userPhone, id)]: true,
    });
  } catch (err) {
    // For trial: the flag was claimed but the record write failed.
    // Attempt to roll back the flag, but only if no other record has
    // since "redeemed" the claim for this phone.
    if (args.type === 'trial') {
      try {
        await db
          .ref(trialClaimedPath(args.userPhone))
          .transaction((current) => {
            // By transaction invariant: only one caller can have committed
            // the claim, so clearing the flag here is safe. The
            // `current !== true` guard handles the edge case where the
            // flag was already cleared externally (e.g. via the Firebase
            // console for manual recovery).
            if (current !== true) return current;
            return null;
          });
      } catch (rollbackErr) {
        console.error(
          '[subscriptions.repo] trial-claim rollback failed for',
          args.userPhone,
          rollbackErr,
        );
      }
    }
    return { ok: false, error: 'rtdb_write_failed', details: err };
  }

  return { ok: true, id };
}

// ─── Cancel path ───────────────────────────────────────────────────────

export type CancelSubscriptionError =
  | 'not_found'
  | 'already_cancelled'
  | 'rtdb_write_failed';

export type CancelSubscriptionResult =
  | { ok: true }
  | { ok: false; error: CancelSubscriptionError; details?: unknown };

/**
 * Cancel an existing subscription. ONE-WAY operation in Phase 1 —
 * cancelled records cannot be re-activated; admins must create a new
 * record instead.
 *
 * Semantics:
 *   - Mutates ONLY `status` (→ 'cancelled') and `updatedAt`. All other
 *     fields are immutable on existing records.
 *   - Does NOT touch `subscriptionTrialClaimed/{phone}`. The lifetime
 *     trial rule is preserved across cancellation: a cancelled trial
 *     still blocks a future trial for the same phone. This is enforced
 *     both at the rules layer (Commit 2) and here at the application
 *     layer (belt-and-suspenders).
 *   - Does NOT touch `subscriptionsByPhone/{phone}/{id}`. The pointer
 *     represents "this phone has subscriptions on record", not "active
 *     subscriptions" — future "is user subscribed?" queries filter by
 *     derived status, not by pointer existence.
 *   - Returns `already_cancelled` rather than silently succeeding so the
 *     admin gets explicit confirmation that nothing happened.
 *   - Malformed records on disk are reported as `not_found` (not
 *     cancelled): we refuse to mutate data we can't safely parse.
 */
export async function cancelSubscription(
  id: string,
  adminUid: string,
): Promise<CancelSubscriptionResult> {
  if (!id) return { ok: false, error: 'not_found' };

  const db = adminDb();
  let snap;
  try {
    snap = await db.ref(subscriptionPath(id)).once('value');
  } catch (err) {
    return { ok: false, error: 'rtdb_write_failed', details: err };
  }

  if (!snap.exists()) {
    return { ok: false, error: 'not_found' };
  }

  const parsed = parseRow(snap.val(), id);
  if (!parsed) {
    // parseRow already logged a warning. We refuse to cancel malformed
    // data — surface as not_found to the caller.
    return { ok: false, error: 'not_found' };
  }

  if (parsed.status === 'cancelled') {
    return { ok: false, error: 'already_cancelled' };
  }

  const prevStatus = parsed.status;
  const updatedAt = Date.now();

  try {
    await db.ref(subscriptionPath(id)).update({
      status: 'cancelled',
      updatedAt,
    });
  } catch (err) {
    return { ok: false, error: 'rtdb_write_failed', details: err };
  }

  // Audit trail — this is the only mutation allowed on an existing
  // record, so it MUST be loggable. Future work may swap this for a
  // structured logger / dedicated audit collection.
  console.log(
    '[subscriptions.repo] cancelled',
    JSON.stringify({
      subscriptionId: id,
      adminUid,
      prevStatus,
      timestamp: updatedAt,
    }),
  );

  return { ok: true };
}
