import 'server-only';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getAdminApp } from '@/server/firebaseAdmin';
import { searchYouTubeServer } from '@/server/youtube';
import { openAI, runAgent } from './agent';
import { VoiceError, VoiceService } from './service';

export function runtimeServices() {
  const client = openAI();
  try {
    const app = getAdminApp();
    const service = new VoiceService(getDatabase(app), async token => (await getAuth(app).verifyIdToken(token, true)).uid,
      (text, session) => runAgent(client, text, session), searchYouTubeServer);
    return { client, service };
  } catch { throw new VoiceError(503, 'Voice is unavailable: Firebase Admin is not configured.', 'not_configured'); }
}

export function bearer(req: Request) {
  const value = req.headers.get('authorization') ?? '';
  if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(value)) throw new VoiceError(401, 'Voice session token required.');
  return value.slice(7);
}

export function clientScope(req: Request) {
  // Use only hosting-provider-owned headers; never trust a caller-supplied
  // generic X-Forwarded-For value as a rate-limit identity.
  const value = req.headers.get('x-vercel-forwarded-for') ?? req.headers.get('cf-connecting-ip');
  if (!value) return undefined;
  return value.split(',')[0].trim().slice(0, 128) || undefined;
}

export async function limitedBytes(req: Request, maximum: number) {
  if (Number(req.headers.get('content-length')) > maximum) throw new VoiceError(413, 'Voice input is too large.');
  const reader = req.body?.getReader();
  if (!reader) throw new VoiceError(400, 'Missing request body.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new VoiceError(413, 'Voice input is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function jsonBody(req: Request) {
  const bytes = await limitedBytes(req, 16_384);
  try {
    const result = JSON.parse(bytes.toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
    return result;
  } catch { throw new VoiceError(400, 'Invalid JSON body.'); }
}

export async function respond(fn: () => Promise<unknown>): Promise<Response> {
  try { return Response.json(await fn(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) {
    const known = error instanceof VoiceError;
    return Response.json({ error: known ? error.code : 'voice_unavailable', message: known ? error.message : 'Voice service unavailable. Please retry.' },
      { status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store', ...(known && error.status === 429 ? { 'Retry-After': '60' } : known && error.status === 409 ? { 'Retry-After': '2' } : {}) } });
  }
}
