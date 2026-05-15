import { NextRequest, NextResponse } from 'next/server';
import { recordQueueOp } from '@/lib/analytics/serverAnalytics';

export const dynamic = 'force-dynamic';

const NO_CONTENT = new NextResponse(null, { status: 204 });
const BAD_REQUEST = new NextResponse(null, { status: 400 });

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return BAD_REQUEST;
  }

  if (!body || typeof body !== 'object') return BAD_REQUEST;
  const { roomId, action } = body as Record<string, unknown>;
  if (typeof roomId !== 'string' || roomId.length === 0) return BAD_REQUEST;
  if (action !== 'add' && action !== 'remove') return BAD_REQUEST;

  recordQueueOp(roomId, action);
  return NO_CONTENT;
}
