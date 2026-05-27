import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  requireAdmin,
  AdminAuthError,
} from '@/features/admin/lib/requireAdmin';
import {
  createSubscription,
  listSubscriptions,
} from '@/lib/subscriptions/repo';
import { CreateSubscriptionInputSchema } from '@/lib/subscriptions/schema';
import { toE164VN } from '@/lib/subscriptions/phone';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

const TRIAL_DUPLICATE_MESSAGE =
  'Số điện thoại này đã sử dụng dùng thử trước đó.';
const INVALID_PHONE_MESSAGE =
  'Số điện thoại không hợp lệ. Định dạng: 0XXXXXXXXX';

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json(
        { error: err.code },
        { status: 401, headers: NO_STORE },
      );
    }
    throw err;
  }

  const records = await listSubscriptions();
  return NextResponse.json(records, {
    status: 200,
    headers: NO_STORE,
  });
}

// Map a Zod error's first issue per field into { fieldName: message } so
// the form can render inline. Multiple issues on the same path collapse
// to the first message — the form only renders one error per field.
function zodIssuesToFields(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_root';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json(
        { error: err.code },
        { status: 401, headers: NO_STORE },
      );
    }
    throw err;
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_input', fields: { _root: 'invalid_json' } },
      { status: 400, headers: NO_STORE },
    );
  }

  const parsed = CreateSubscriptionInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', fields: zodIssuesToFields(parsed.error) },
      { status: 400, headers: NO_STORE },
    );
  }

  const input = parsed.data;
  const phoneE164 = toE164VN(input.userPhone);
  if (!phoneE164) {
    return NextResponse.json(
      {
        error: 'invalid_input',
        fields: { userPhone: INVALID_PHONE_MESSAGE },
      },
      { status: 400, headers: NO_STORE },
    );
  }

  const startDate = input.startDate ?? Date.now();
  const paymentRef =
    input.type === 'paid' ? (input.paymentRef as string) : null;

  const result = await createSubscription({
    userPhone: phoneE164,
    type: input.type,
    durationDays: input.durationDays,
    paymentRef,
    startDate,
    source: 'manual_admin',
    createdBy: admin.uid,
  });

  if (result.ok) {
    return NextResponse.json(
      { id: result.id },
      { status: 201, headers: NO_STORE },
    );
  }

  if (result.error === 'trial_already_claimed') {
    return NextResponse.json(
      {
        error: 'trial_already_claimed',
        message: TRIAL_DUPLICATE_MESSAGE,
      },
      { status: 409, headers: NO_STORE },
    );
  }

  if (result.error === 'invalid_input') {
    // Should be caught by the pre-validation above — defence in depth.
    return NextResponse.json(
      { error: 'invalid_input' },
      { status: 400, headers: NO_STORE },
    );
  }

  console.error(
    '[api/admin/subscriptions] rtdb_write_failed:',
    result.details,
  );
  return NextResponse.json(
    { error: 'internal' },
    { status: 500, headers: NO_STORE },
  );
}
