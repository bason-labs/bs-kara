import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  requireAdmin,
  AdminAuthError,
} from '@/features/admin/lib/requireAdmin';
import {
  cancelSubscription,
  getSubscription,
} from '@/lib/subscriptions/repo';
import { derive, daysLeft } from '@/lib/subscriptions/expiry';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

const NOT_FOUND_MESSAGE = 'Không tìm thấy gói đăng ký.';
const ALREADY_CANCELLED_MESSAGE = 'Gói đăng ký này đã được huỷ trước đó.';

const PatchBodySchema = z
  .object({
    // Discriminator field — additive actions (e.g. 'extend') become
    // additive enum values without breaking the contract.
    action: z.literal('cancel'),
  })
  .strict();

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
      { error: 'invalid_input' },
      { status: 400, headers: NO_STORE },
    );
  }

  // Only action today is 'cancel'. The literal enforces it; the switch
  // below is here so a future 'extend' or similar action is an obvious
  // additive change rather than a silent fall-through.
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
