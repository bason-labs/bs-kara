import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/features/admin/lib/firebaseAdmin', () => ({ getAdminApp: () => { throw new Error('missing credentials'); } }));
vi.mock('openai', () => ({ default: class OpenAI {}, toFile: vi.fn() }));
import { POST as session } from '@/app/api/voice/session/route';
import { POST as turn } from '@/app/api/voice/turn/route';
import { POST as transcribe } from '@/app/api/voice/transcribe/route';
import { clientScope } from './http';
afterEach(() => vi.unstubAllEnvs());
describe('voice HTTP boundary', () => {
  it('does not collapse clients into one fallback rate-limit scope', () => {
    expect(clientScope(new Request('http://localhost'))).toBeUndefined();
    expect(clientScope(new Request('http://localhost', { headers: { 'x-vercel-forwarded-for': '203.0.113.7' } }))).toBe('203.0.113.7');
  });
  it('returns a clear 503 when OpenAI credentials are absent', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const response = await session(new Request('http://localhost/api/voice/session', { method: 'POST', body: JSON.stringify({ roomCode: '1234', language: 'en' }) }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'not_configured', message: 'Voice is unavailable: OPENAI_API_KEY is not configured.' });
  });
  it('returns 503 without exposing admin initialization details', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const response = await session(new Request('http://localhost', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'not_configured', message: 'Voice is unavailable: Firebase Admin is not configured.' });
  });
  it('rejects missing bearer authentication before provider initialization', async () => {
    expect((await turn(new Request('http://localhost', { method: 'POST', body: '{}' }))).status).toBe(401);
    expect((await transcribe(new Request('http://localhost', { method: 'POST' }))).status).toBe(401);
  });
  it('rejects malformed and oversized JSON', async () => {
    expect((await session(new Request('http://localhost', { method: 'POST', body: '{' }))).status).toBe(400);
    expect((await session(new Request('http://localhost', { method: 'POST', body: 'x'.repeat(17000) }))).status).toBe(413);
  });
});
