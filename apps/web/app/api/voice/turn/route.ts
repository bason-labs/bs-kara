import { bearer, jsonBody, respond, runtimeServices } from '@/features/voice/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(req: Request) {
  return respond(async () => {
    const token = bearer(req);
    const body = await jsonBody(req);
    return runtimeServices().service.turn(token, body);
  });
}
