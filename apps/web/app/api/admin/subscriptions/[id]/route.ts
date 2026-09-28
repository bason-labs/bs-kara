import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  requireAdmin,
  AdminAuthError,
} from '@/server/admin/requireAdmin';
import {
  cancelSubscription,
  deleteSubscription,
  getSubscription,
  updateSubscription,
} from '@/server/subscriptions/repo';
import { derive, daysLeft } from '@/lib/subscriptions/expiry';
import { UpdateSubscriptionInputSchema } from '@/lib/subscriptions/schema';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

const NOT_FOUND_MESSAGE = 'Không tìm thấy gói đăng ký.';
const ALREADY_CANCELLED_MESSAGE = 'Gói đăng ký này đã được huỷ trước đó.';

const PatchBodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('cancel') }).strict(),
  z.object({ action: z.literal('update'), changes: UpdateSubscriptionInputSchema }).strict(),
]);

function firstIssueFields(err: z.ZodError): Record<string, string> {
  const issue = err.issues[0];
  // An unknown key (e.g. userPhone, type) is an attempt to edit a locked field.
  if (issue.code === 'unrecognized_keys') {
    return { [issue.keys[0]]: 'Không thể sửa số điện thoại hoặc loại gói.' };
  }
  // Drop the 'changes.' prefix so fields match the form's field names.
  return { [issue.path.filter((p) => p !== 'changes').join('.') || '_root']: issue.message };
}

function unauth(err: unknown): NextResponse | null {
  if (err instanceof AdminAuthError) {
    return NextResponse.json(
      { error: err.code },
      { status: 401, headers: NO_STORE },
    );
  }
  return null;
}

function validatedId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch (err) {
    const r = unauth(err);
    if (r) return r;
    throw err;
  }

  const { id: rawId } = await ctx.params;
  const id = validatedId(rawId);
  if (!id) {
    return NextResponse.json(
      { error: 'invalid_id' },
      { status: 400, headers: NO_STORE },
    );
  }

  const record = await getSubscription(id);
  if (!record) {
    return NextResponse.json(
      { error: 'not_found' },
      { status: 404, headers: NO_STORE },
    );
  }

  const now = Date.now();
  return NextResponse.json(
    {
      record,
      derivedStatus: derive(record, now),
      daysLeft: daysLeft(record, now),
    },
    { status: 200, headers: NO_STORE },
  );
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    const r = unauth(err);
    if (r) return r;
    throw err;
  }

  const { id: rawId } = await ctx.params;
  const id = validatedId(rawId);
  if (!id) {
    return NextResponse.json(
      { error: 'invalid_id' },
      { status: 400, headers: NO_STORE },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_input' },
      { status: 400, headers: NO_STORE },
    );
  }

  const parsed = PatchBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', fields: firstIssueFields(parsed.error) },
      { status: 400, headers: NO_STORE },
    );
  }

  if (parsed.data.action === 'update') {
    const updated = await updateSubscription(id, parsed.data.changes, admin.uid);
    if (updated.ok) {
      return NextResponse.json({ ok: true, record: updated.record }, { status: 200, headers: NO_STORE });
    }
    if (updated.error === 'not_found') {
      return NextResponse.json({ error: 'not_found', message: NOT_FOUND_MESSAGE }, { status: 404, headers: NO_STORE });
    }
    if (updated.error === 'invalid_input') {
      return NextResponse.json(
        { error: 'invalid_input', fields: { [updated.field]: updated.message } },
        { status: 400, headers: NO_STORE },
      );
    }
    console.error('[api/admin/subscriptions/[id]] update rtdb_write_failed:', updated.details);
    return NextResponse.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
  }

  const result = await cancelSubscription(id, admin.uid);

  if (result.ok) {
    return NextResponse.json(
      { ok: true },
      { status: 200, headers: NO_STORE },
    );
  }

  if (result.error === 'not_found') {
    return NextResponse.json(
      { error: 'not_found', message: NOT_FOUND_MESSAGE },
      { status: 404, headers: NO_STORE },
    );
  }

  if (result.error === 'already_cancelled') {
    return NextResponse.json(
      { error: 'already_cancelled', message: ALREADY_CANCELLED_MESSAGE },
      { status: 409, headers: NO_STORE },
    );
  }

  console.error(
    '[api/admin/subscriptions/[id]] rtdb_write_failed:',
    result.details,
  );
  return NextResponse.json(
    { error: 'internal' },
    { status: 500, headers: NO_STORE },
  );
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    const r = unauth(err);
    if (r) return r;
    throw err;
  }

  const { id: rawId } = await ctx.params;
  const id = validatedId(rawId);
  if (!id) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400, headers: NO_STORE });
  }

  const result = await deleteSubscription(id, admin.uid);
  if (result.ok) {
    return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
  }
  if (result.error === 'not_found') {
    return NextResponse.json({ error: 'not_found', message: NOT_FOUND_MESSAGE }, { status: 404, headers: NO_STORE });
  }
  console.error('[api/admin/subscriptions/[id]] delete rtdb_write_failed:', result.details);
  return NextResponse.json({ error: 'internal' }, { status: 500, headers: NO_STORE });
}
