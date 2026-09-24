import { clientScope, jsonBody, respond, runtimeServices } from '@/features/voice/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  return respond(async () => {
    const body = await jsonBody(req);
    return runtimeServices().service.create(body, clientScope(req));
  });
}
