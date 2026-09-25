import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from 'firebase-admin/database';
import { VoiceService } from './service';

// In-memory RTDB boundary: transaction callbacks operate on fresh cloned state.
function database() {
  const values: Record<string, unknown> = {};
  let nextKey = 0;
  let loseRoomAck = false;
  const ref = (path: string) => ({
    orderByChild: () => ({ endAt: (cutoff: number) => ({ limitToFirst: (limit: number) => ({ once: async () => ({ val: () => Object.fromEntries(Object.entries(values).filter(([key, value]) => key.startsWith(`${path}/`) && (value as { expiresAt: number }).expiresAt <= cutoff).slice(0, limit).map(([key, value]) => [key.slice(path.length + 1), value])) }) }) }) }),
    update: async (updates: Record<string, unknown>) => { for (const [key, value] of Object.entries(updates)) { if (value === null) delete values[`${path}/${key}`]; else values[`${path}/${key}`] = value; } },
    push: () => ({ key: `push_${String(++nextKey).padStart(6, '0')}` }),
    once: async () => ({ val: () => structuredClone(values[path] ?? null) }),
    set: async (value: unknown) => { values[path] = structuredClone(value); },
    transaction: async (fn: (value: unknown) => unknown) => {
      const next = fn(structuredClone(values[path] ?? null));
      if (next !== undefined) values[path] = structuredClone(next);
      if (path.startsWith('rooms/') && next !== undefined && loseRoomAck) { loseRoomAck = false; throw new Error('lost acknowledgement'); }
      return { committed: next !== undefined, snapshot: { val: () => structuredClone(values[path] ?? null) } };
    },
  });
  return { values, db: { ref } as unknown as Database, loseNextRoomAck: () => { loseRoomAck = true; } };
}
const video = { id: 'abcdefghijk', title: 'Song', channel: 'Artist', thumbnail: '', duration: '' };
let store: ReturnType<typeof database>;
let service: VoiceService;
let now: number;
const agent = vi.fn();
beforeEach(() => {
  now = 1000;
  store = database();
  store.values['rooms/1234'] = { hostUid: 'host', requesterPromptEnabled: false, voiceChatEnabled: true };
  store.values['roomCodeIndex/1234'] = '84901234567';
  store.values['registeredUsers/84901234567'] = {};
  store.values['subscriptionsByPhone/+84901234567'] = { sub: true };
  store.values['subscriptions/sub'] = { status: 'active', endDate: 9999999 };
  agent.mockReset().mockResolvedValue({ name: 'searchSongs', args: { query: 'song' } });
  service = new VoiceService(store.db, async () => 'host', agent, async () => [video], () => now);
});
const mint = () => service.create({ roomCode: '1234', language: 'en' });
describe('voice server boundary', () => {
  it('rejects session creation when voice chat is disabled or missing', async () => {
    store.values['rooms/1234'] = { requesterPromptEnabled: false };
    await expect(mint()).rejects.toMatchObject({ status: 403 });
    store.values['rooms/1234'] = { voiceChatEnabled: false };
    await expect(mint()).rejects.toMatchObject({ status: 403 });
  });

  it('revokes an existing voice session when the host disables voice chat', async () => {
    store.values['rooms/1234'] = { voiceChatEnabled: true, requesterPromptEnabled: false };
    const credentials = await mint();
    store.values['rooms/1234'] = { voiceChatEnabled: false, requesterPromptEnabled: false };
    await expect(service.authenticate(credentials.sessionId, credentials.token)).rejects.toMatchObject({ status: 403 });
  });

  it('does not share room mint limits with global or transcription counters', async () => {
    await service.limit('mint-global', 60);
    for (let i = 0; i < 5; i++) await service.limit('mint-1110', 5);
    await expect(service.limit('mint-1110', 5)).rejects.toMatchObject({ status: 429 });
    for (let i = 0; i < 5; i++) await service.limit('mint-1045', 5);
    await expect(service.limit('transcribe-global', 60)).resolves.toBeUndefined();
  });

  it('releases a definitely rejected command so the user can provide a requester', async () => {
    const c = await mint();
    const results = (await service.turn(c.token, { sessionId: c.sessionId, requestId: 's', text: 'song' })).results!;
    const authenticate = service.authenticate.bind(service);
    let checks = 0;
    vi.spyOn(service, 'authenticate').mockImplementation(async (...args) => {
      const state = await authenticate(...args);
      if (++checks === 2) store.values['rooms/1234'] = { requesterPromptEnabled: true, voiceChatEnabled: true };
      return state;
    });
    const pick = { sessionId: c.sessionId, requestId: 'pick', selection: { searchId: results.searchId, position: 1 } };
    await expect(service.turn(c.token, pick)).rejects.toMatchObject({ code: 'command_rejected' });
    agent.mockResolvedValue({ name: 'setRequester', args: { name: 'Lan' } });
    await service.turn(c.token, { sessionId: c.sessionId, requestId: 'name', text: 'Lan' });
    const response = await service.turn(c.token, { ...pick, requestId: 'pick2' });
    expect(response.receipt?.video.requesterName).toBe('Lan');
  });
  it('passes recent committed conversation to follow-up intent extraction', async () => {
    const c = await mint();
    const first = await service.turn(c.token, { sessionId: c.sessionId, requestId: 's', text: 'Happy Birthday' });
    agent.mockResolvedValue({ name: 'reply', args: { text: 'Which version?' } });
    await service.turn(c.token, { sessionId: c.sessionId, requestId: 'f', text: 'A different version' });
    expect(agent.mock.calls[1][1].history).toEqual([
      { role: 'user', content: 'Happy Birthday' },
      { role: 'assistant', content: first.reply },
    ]);
  });
  it('persists a hash, never the bearer token', async () => {
    const creds = await mint();
    expect(JSON.stringify(store.values)).not.toContain(creds.token);
    expect(creds.token.length).toBeGreaterThanOrEqual(43);
  });
  it('rejects missing rooms and expired guest subscriptions', async () => {
    delete store.values['rooms/1234'];
    await expect(mint()).rejects.toMatchObject({ status: 404 });
    store.values['rooms/1234'] = {};
    store.values['subscriptions/sub'] = { status: 'active', endDate: 0 };
    await expect(mint()).rejects.toMatchObject({ status: 403 });
  });
  it('only bypasses entitlement with verified room ownership', async () => {
    delete store.values['subscriptions/sub'];
    await expect(service.create({ roomCode: '1234', language: 'en', idToken: 'verified' })).resolves.toHaveProperty('token');
    store.values['rooms/1234'] = { hostUid: 'someone-else' };
    await expect(service.create({ roomCode: '1234', language: 'en', idToken: 'verified' })).rejects.toMatchObject({ status: 403 });
  });
  it('checks authentication, expiration and party-end epoch', async () => {
    const c = await mint();
    await expect(service.authenticate(c.sessionId, 'bad')).rejects.toMatchObject({ status: 401 });
    store.values['rooms/1234'] = { lastEndedAt: 2, voiceChatEnabled: true };
    await expect(service.authenticate(c.sessionId, c.token)).rejects.toMatchObject({ status: 410 });
    now += 3600000;
    await expect(service.authenticate(c.sessionId, c.token)).rejects.toMatchObject({ status: 401 });
  });
  it('starts an idle room once and replays the committed receipt', async () => {
    const c = await mint();
    const results = (await service.turn(c.token, { sessionId: c.sessionId, requestId: 'search1', text: 'song' })).results!;
    const body = { sessionId: c.sessionId, requestId: 'choose1', selection: { searchId: results.searchId, position: 1 } };
    const first = await service.turn(c.token, body);
    expect(first.receipt).toEqual({ status: 'started', video });
    expect(await service.turn(c.token, body)).toEqual(first);
    expect(store.values['rooms/1234']).toMatchObject({ currentPlaying: video, isPlaying: true });
    expect(JSON.stringify(store.values['rooms/1234'])).not.toContain(c.token);
    await expect(service.turn(c.token, { ...body, text: 'different', selection: undefined })).rejects.toMatchObject({ status: 409 });
  });
  it('rejects foreign and stale snapshots, invalid positions, and empty input', async () => {
    const c = await mint();
    await expect(service.turn(c.token, { sessionId: c.sessionId, requestId: 'bad', text: '' })).rejects.toMatchObject({ status: 400 });
    await expect(service.turn(c.token, { sessionId: c.sessionId, requestId: 'bad2', selection: { searchId: 'foreign', position: 1 } })).rejects.toMatchObject({ status: 409 });
  });
  it('preserves selected video while collecting requester', async () => {
    store.values['rooms/1234'] = { requesterPromptEnabled: true, voiceChatEnabled: true };
    const c = await mint();
    const results = (await service.turn(c.token, { sessionId: c.sessionId, requestId: 's', text: 'song' })).results!;
    const pending = await service.turn(c.token, { sessionId: c.sessionId, requestId: 'p', selection: { searchId: results.searchId, position: 1 } });
    expect(pending.receipt).toBeUndefined();
    agent.mockResolvedValue({ name: 'setRequester', args: { name: 'Lan' } });
    const added = await service.turn(c.token, { sessionId: c.sessionId, requestId: 'n', text: 'Lan' });
    expect(added.receipt?.video).toEqual({ ...video, requesterName: 'Lan' });
  });
  it('bounds minting across service instances', async () => {
    for (let i = 0; i < 5; i++) await mint();
    await expect(mint()).rejects.toMatchObject({ status: 429 });
  });
  it('does not charge shared room quotas until access succeeds', async () => {
    delete store.values['subscriptions/sub'];
    for (let i = 0; i < 5; i++) {
      await expect(service.create({ roomCode: '1234', language: 'en' }, `client-${i}`)).rejects.toMatchObject({ status: 403 });
    }
    store.values['subscriptions/sub'] = { status: 'active', endDate: 9999999 };
    for (let i = 0; i < 5; i++) await service.create({ roomCode: '1234', language: 'en' }, `valid-${i}`);
    await expect(service.create({ roomCode: '1234', language: 'en' }, 'valid-last')).rejects.toMatchObject({ status: 429 });
  });
  it('recovers an unknown room write outcome without adding twice', async () => {
    const c = await mint();
    const results = (await service.turn(c.token, { sessionId: c.sessionId, requestId: 's', text: 'song' })).results!;
    const body = { sessionId: c.sessionId, requestId: 'pick', selection: { searchId: results.searchId, position: 1 } };
    store.loseNextRoomAck();
    await expect(service.turn(c.token, body)).rejects.toThrow('lost acknowledgement');
    expect((await service.turn(c.token, body)).receipt?.status).toBe('started');
    expect(store.values['rooms/1234']).not.toHaveProperty('queue');
  });
  it('serializes concurrent requests and rejects consumed result replay under a new ID', async () => {
    const c = await mint();
    let resolve!: (value: { name: string; args: Record<string, unknown> }) => void;
    agent.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const search = service.turn(c.token, { sessionId: c.sessionId, requestId: 'first', text: 'song' });
    await vi.waitFor(() => expect(resolve).toBeDefined());
    await expect(service.turn(c.token, { sessionId: c.sessionId, requestId: 'second', text: 'another' })).rejects.toMatchObject({ status: 409 });
    resolve({ name: 'searchSongs', args: { query: 'song' } });
    const results = (await search).results!;
    const selection = { searchId: results.searchId, position: 1 };
    await service.turn(c.token, { sessionId: c.sessionId, requestId: 'pick', selection });
    await expect(service.turn(c.token, { sessionId: c.sessionId, requestId: 'old', selection })).rejects.toMatchObject({ status: 409 });
  });
  it('queues two guests in chronological push-key order', async () => {
    store.values['rooms/1234'] = { currentPlaying: video, requesterPromptEnabled: false, voiceChatEnabled: true };
    for (let i = 0; i < 2; i++) {
      const c = await mint();
      const results = (await service.turn(c.token, { sessionId: c.sessionId, requestId: 's', text: 'song' })).results!;
      const response = await service.turn(c.token, { sessionId: c.sessionId, requestId: 'p', selection: { searchId: results.searchId, position: 1 } });
      expect(response.receipt?.status).toBe('queued');
    }
    const room = store.values['rooms/1234'] as { queue: Record<string, unknown> };
    expect(Object.keys(room.queue)).toEqual(['push_000001', 'push_000002']);
  });
  it('rejects expired snapshots and rechecks guest access on every turn', async () => {
    const c = await mint();
    const results = (await service.turn(c.token, { sessionId: c.sessionId, requestId: 's', text: 'song' })).results!;
    now += 301000;
    await expect(service.turn(c.token, { sessionId: c.sessionId, requestId: 'p', selection: { searchId: results.searchId, position: 1 } })).rejects.toMatchObject({ status: 409 });
    store.values['registeredUsers/84901234567'] = { suspended: true };
    await expect(service.turn(c.token, { sessionId: c.sessionId, requestId: 't', text: 'song' })).rejects.toMatchObject({ status: 403 });
  });
});
