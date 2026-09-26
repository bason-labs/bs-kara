import { NextResponse } from 'next/server';

// Read per request, not at build time: the same image runs with whatever
// APP_VERSION (git SHA) the deploy sets.
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  const version = process.env.APP_VERSION || 'dev';
  return NextResponse.json(
    { ok: true, version },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
