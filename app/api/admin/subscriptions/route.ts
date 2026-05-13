import { NextResponse } from 'next/server';
import {
  requireAdmin,
  AdminAuthError,
} from '@/features/admin/lib/requireAdmin';
import { listSubscriptions } from '@/lib/subscriptions/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json(
        { error: err.code },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    throw err;
  }

  const records = await listSubscriptions();
  return NextResponse.json(records, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
