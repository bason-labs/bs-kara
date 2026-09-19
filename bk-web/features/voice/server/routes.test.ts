import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  authenticate: vi.fn(), limit: vi.fn(), turn: vi.fn(), create: vi.fn(), transcribe: vi.fn(), metadata: vi.fn(),
}));
vi.mock('music-metadata', () => ({ parseBuffer: boundary.metadata }));
vi.mock('./http', async importOriginal => ({
  ...await importOriginal<typeof import('./http')>(),
  runtimeServices: () => ({ service: { authenticate: boundary.authenticate, limit: boundary.limit, turn: boundary.turn, create: boundary.create },
    client: { audio: { transcriptions: { create: boundary.transcribe } } } }),
}));
import { POST as transcribe } from '@/app/api/voice/transcribe/route';
import { POST as turn } from '@/app/api/voice/turn/route';
import { VoiceError } from './service';

const token = 'a'.repeat(43);
function audioRequest(type = 'audio/webm', bytes = 'audio') {
  // Wire fixture avoids jsdom File being stringified by Node's Request encoder.
  const body = ['--voice-test', 'Content-Disposition: form-data; name="sessionId"', '', 'session1',
    '--voice-test', 'Content-Disposition: form-data; name="audio"; filename="voice.webm"', `Content-Type: ${type}`, '', bytes, '--voice-test--', ''].join('\r\n');
  return new Request('http://localhost/api/voice/transcribe', { method: 'POST', headers: {
    Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data; boundary=voice-test',
  }, body });
}
beforeEach(() => {
  vi.resetAllMocks();
  boundary.authenticate.mockResolvedValue({ roomCode: '1234', language: 'vi' });
  boundary.transcribe.mockResolvedValue({ text: ' Bài đầu tiên ', duration: 2 });
  boundary.metadata.mockResolvedValue({ format: { duration: 2 } });
});
describe('voice route payloads', () => {
  it('authenticates and rate-limits audio before transcription, then rechecks access', async () => {
    const response = await transcribe(audioRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: 'Bài đầu tiên' });
    expect(boundary.authenticate).toHaveBeenCalledTimes(2);
    expect(boundary.limit).toHaveBeenCalledWith('transcribe-1234', 12);
    expect(boundary.authenticate.mock.invocationCallOrder[0]).toBeLessThan(boundary.transcribe.mock.invocationCallOrder[0]);
    expect(boundary.transcribe).toHaveBeenCalledWith(expect.objectContaining({ model: 'whisper-1', language: 'vi' }));
  });
  it('rejects unsupported, empty, and oversized audio without billing', async () => {
    expect((await transcribe(audioRequest('text/plain'))).status).toBe(415);
    expect((await transcribe(audioRequest('audio/webm', ''))).status).toBe(400);
    expect((await transcribe(audioRequest('audio/webm', 'x'.repeat(2 * 1024 * 1024 + 1)))).status).toBe(413);
    expect(boundary.transcribe).not.toHaveBeenCalled();
  });
  it('does not transcribe for revoked sessions', async () => {
    boundary.authenticate.mockRejectedValue(new VoiceError(403, 'Denied'));
    expect((await transcribe(audioRequest())).status).toBe(403);
    expect(boundary.transcribe).not.toHaveBeenCalled();
  });
  it('rejects empty transcription', async () => {
    boundary.transcribe.mockResolvedValue({ text: ' ', duration: 2 });
    expect((await transcribe(audioRequest())).status).toBe(422);
  });
  it('rejects overlong or unreadable audio before the provider call', async () => {
    boundary.metadata.mockResolvedValueOnce({ format: { duration: 46 } });
    expect((await transcribe(audioRequest())).status).toBe(413);
    boundary.metadata.mockRejectedValueOnce(new Error('invalid container'));
    expect((await transcribe(audioRequest())).status).toBe(422);
    expect(boundary.transcribe).not.toHaveBeenCalled();
  });
  it('returns the service receipt unchanged and disables caching', async () => {
    const responseBody = { reply: 'Added', receipt: { status: 'queued', video: { id: 'song' } } };
    boundary.turn.mockResolvedValue(responseBody);
    const body = { sessionId: 'session1', requestId: 'request1', text: 'First one' };
    const response = await turn(new Request('http://localhost/api/voice/turn', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }));
    expect(boundary.turn).toHaveBeenCalledWith(token, body);
    expect(await response.json()).toEqual(responseBody);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
