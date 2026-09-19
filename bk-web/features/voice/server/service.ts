import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Database } from 'firebase-admin/database';
import type { YouTubeVideo } from '@bs-kara/shared';
import type { VoiceLanguage, VoiceReceipt, VoiceResults, VoiceTurnRequest, VoiceTurnResponse } from '../types';

export class VoiceError extends Error {
  constructor(public status: number, message: string, public code = status === 401 ? 'invalid_session' : status === 404 || status === 410 || status === 403 ? 'room_unavailable' : status === 429 ? 'rate_limited' : status === 409 ? 'turn_pending' : status === 503 ? 'voice_unavailable' : 'invalid_input') { super(message); }
}
const fail = (status: number, message: string): never => { throw new VoiceError(status, message); };
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const id = () => randomBytes(24).toString('base64url');
const safeId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const SESSION_MS = 30 * 60_000;
const SNAPSHOT_MS = 5 * 60_000;
const LEASE_MS = 60_000;
type Receipts = Record<string, { status: VoiceReceipt['status']; expiresAt: number }>;
type Room = { hostUid?: string; lastEndedAt?: number; requesterPromptEnabled?: boolean; voiceChatEnabled?: boolean; currentPlaying?: YouTubeVideo; isPlaying?: boolean; queue?: Record<string, YouTubeVideo>; voiceReceipts?: string };
export type Action = { name: string; args: Record<string, unknown> };
type Plan = { response: VoiceTurnResponse; video?: YouTubeVideo; queueKey?: string; results?: VoiceResults & { expiresAt: number }; pending?: YouTubeVideo | null; requester?: string; consume?: boolean };
type RequestRecord = { hash: string; response?: VoiceTurnResponse; plan?: Plan; failure?: { status: number; message: string; code: string } };
export type Session = {
  tokenHash: string; roomCode: string; language: VoiceLanguage; expiresAt: number;
  epoch: number; hostUid?: string; results?: VoiceResults & { expiresAt: number };
  pending?: YouTubeVideo; requester?: string; requests?: Record<string, RequestRecord>;
  history?: { role: 'user' | 'assistant'; content: string }[];
  lock?: { requestId: string; owner: string; until: number };
};
export type Agent = (text: string, session: Session) => Promise<Action>;

export class VoiceService {
  constructor(private db: Database, private verifyToken: (token: string) => Promise<string>, private agent: Agent,
    private search: (query: string) => Promise<YouTubeVideo[]>, private now = Date.now) {}

  // Scope keys never collide; expired counters are pruned alongside sessions.
  async limit(scope: string, maximum: number, windowMs = 60_000) {
    const ref = this.db.ref(`voiceSessions/rateLimits/${hash(scope)}`);
    const now = this.now();
    const result = await ref.transaction((raw: { start: number; count: number } | null) => {
      const value = raw && raw.start + windowMs > now ? raw : { start: now, count: 0 };
      return value.count >= maximum ? undefined : { ...value, count: value.count + 1, expiresAt: value.start + windowMs };
    });
    if (!result.committed) fail(429, 'Voice rate limit exceeded. Try again later.');
  }

  private async room(roomCode: string): Promise<Room> {
    return (await this.db.ref(`rooms/${roomCode}`).once('value')).val() ?? fail(404, 'Room not found.');
  }

  private async access(roomCode: string, room: Room, hostUid?: string) {
    if (hostUid && room.hostUid === hostUid) return;
    const phone = (await this.db.ref(`roomCodeIndex/${roomCode}`).once('value')).val();
    if (typeof phone !== 'string' || !/^\d{8,15}$/.test(phone)) fail(403, 'Room access denied.');
    const user = (await this.db.ref(`registeredUsers/${phone}`).once('value')).val();
    if (!user || user.suspended === true) fail(403, 'Room access denied.');
    const index = (await this.db.ref(`subscriptionsByPhone/+${phone}`).once('value')).val() ?? {};
    const ids = Object.keys(index);
    if (ids.length > 100 || ids.some(key => !safeId(key))) fail(403, 'Room access denied.');
    const subs = await Promise.all(ids.map(key => this.db.ref(`subscriptions/${key}`).once('value')));
    if (!subs.some(s => s.val()?.status === 'active' && typeof s.val()?.endDate === 'number' && s.val().endDate >= this.now())) {
      fail(403, 'Room subscription expired.');
    }
  }

  async create(body: { roomCode?: unknown; language?: unknown; idToken?: unknown }, clientScope?: string) {
    if (!body || typeof body.roomCode !== 'string' || !/^\d{4}$/.test(body.roomCode) || !['vi', 'en'].includes(String(body.language))) fail(400, 'Invalid room or language.');
    if (body.idToken !== undefined && (typeof body.idToken !== 'string' || !body.idToken || body.idToken.length > 8192)) fail(400, 'Invalid ID token.');
    const roomCode = body.roomCode as string;
    if (clientScope) await this.limit(`mint-client-${clientScope}`, 10);
    await this.cleanup();
    const room = await this.room(roomCode);
    if (room.voiceChatEnabled !== true) fail(403, 'Voice Chat is disabled for this room.');
    let hostUid: string | undefined;
    if (body.idToken) {
      try { hostUid = await this.verifyToken(body.idToken as string); } catch { fail(401, 'Invalid host identity.'); }
      if (room.hostUid !== hostUid) hostUid = undefined;
    }
    await this.access(roomCode, room, hostUid);
    await this.limit('mint-global', 60);
    await this.limit(`mint-${roomCode}`, 5);
    const sessionId = id();
    const token = randomBytes(32).toString('base64url');
    const session: Session = { tokenHash: hash(token), roomCode, language: body.language as VoiceLanguage,
      expiresAt: this.now() + SESSION_MS, epoch: room.lastEndedAt ?? 0 };
    if (hostUid) session.hostUid = hostUid;
    await this.db.ref(`voiceSessions/sessions/${sessionId}`).set(session);
    return { sessionId, token };
  }

  private async cleanup() {
    for (const path of ['sessions', 'rateLimits']) {
      const ref = this.db.ref(`voiceSessions/${path}`);
      const expired = await ref.orderByChild('expiresAt').endAt(this.now()).limitToFirst(20).once('value');
      const updates: Record<string, null> = {};
      for (const key of Object.keys(expired.val() ?? {})) updates[key] = null;
      if (Object.keys(updates).length) await ref.update(updates);
    }
  }

  async authenticate(sessionId: string, token: string): Promise<Session> {
    if (!safeId(sessionId) || typeof token !== 'string' || token.length > 200) fail(401, 'Invalid voice session.');
    const session: Session | null = (await this.db.ref(`voiceSessions/sessions/${sessionId}`).once('value')).val();
    if (session && session.expiresAt <= this.now()) throw new VoiceError(401, 'Voice session expired.', 'session_expired');
    if (!session || !/^[a-f0-9]{64}$/.test(session.tokenHash) ||
      !timingSafeEqual(Buffer.from(session.tokenHash, 'hex'), Buffer.from(hash(token), 'hex'))) fail(401, 'Voice session expired or invalid.');
    const valid = session!;
    const room = await this.room(valid.roomCode);
    if (room.voiceChatEnabled !== true) fail(403, 'Voice Chat is disabled for this room.');
    if ((room.lastEndedAt ?? 0) !== valid.epoch) fail(410, 'Party ended. Start a new voice session.');
    await this.access(valid.roomCode, room, valid.hostUid);
    return valid;
  }

  private async plan(session: Session, body: VoiceTurnRequest): Promise<Plan> {
    const action: Action = body.selection ? { name: 'chooseResult', args: body.selection } : await this.agent(body.text!, session);
    const en = session.language === 'en';
    if (action.name === 'reply') {
      const reply = action.args.text;
      if (typeof reply !== 'string' || !reply.trim() || reply.length > 1000) fail(502, 'Invalid assistant reply.');
      return { response: { reply: reply as string } };
    }
    if (action.name === 'cancel') return { response: { reply: en ? 'Cancelled.' : 'Đã hủy.' }, pending: null, consume: true };
    if (action.name === 'searchSongs') {
      const query = action.args.query;
      if (typeof query !== 'string' || !query.trim() || query.length > 200) fail(400, 'Invalid search.');
      const videos = (await this.search((query as string).trim())).slice(0, 5).map(trustedVideo);
      const results = { searchId: id(), videos, expiresAt: this.now() + SNAPSHOT_MS };
      return { results, pending: null, response: { reply: videos.length ? (en ? 'Which number would you like?' : 'Bạn chọn bài số mấy?') : (en ? 'No songs found.' : 'Không tìm thấy bài hát.'), results: { searchId: results.searchId, videos } } };
    }
    let video: YouTubeVideo;
    let requester = session.requester;
    if (action.name === 'setRequester') {
      const name = action.args.name;
      if (typeof name !== 'string' || !name.trim() || name.length > 60) fail(400, 'Invalid requester name.');
      requester = (name as string).trim();
      if (!session.pending) return { requester, response: { reply: en ? 'Requester saved.' : 'Đã lưu tên người hát.' } };
      video = session.pending!;
    } else if (action.name === 'chooseResult') {
      const { searchId, position } = action.args;
      const snapshot = session.results;
      if (!snapshot || snapshot.searchId !== searchId || snapshot.expiresAt <= this.now() || !Number.isInteger(position) || Number(position) < 1 || Number(position) > snapshot.videos.length) throw new VoiceError(409, 'Selection expired or invalid. Search again.', 'invalid_selection');
      video = snapshot!.videos[Number(position) - 1];
    } else return fail(400, 'Unsupported voice action.');
    const room = await this.room(session.roomCode);
    if (room.requesterPromptEnabled !== false && !requester) {
      return { pending: video, consume: true, response: { reply: en ? 'Who will sing this song?' : 'Ai sẽ hát bài này?' } };
    }
    return { video: { ...video, ...(requester ? { requesterName: requester } : {}) }, pending: null, consume: true,
      ...(requester ? { requester } : {}), response: { reply: '' } };
  }

  async turn(token: string, input: VoiceTurnRequest): Promise<VoiceTurnResponse> {
    if (!input || !safeId(input.sessionId) || !safeId(input.requestId) || (input.text !== undefined) === (input.selection !== undefined)) fail(400, 'Provide exactly one text or selection input.');
    if (input.text !== undefined && (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2000)) fail(400, 'Invalid voice text.');
    if (input.selection !== undefined && (!input.selection || !safeId(input.selection.searchId) || !Number.isInteger(input.selection.position))) fail(400, 'Invalid selection.');
    // Canonicalize only accepted fields; video metadata can never reach the command.
    const body: VoiceTurnRequest = { sessionId: input.sessionId, requestId: input.requestId,
      ...(input.text !== undefined ? { text: input.text.trim() } : { selection: { searchId: input.selection!.searchId, position: input.selection!.position } }) };
    const session = await this.authenticate(body.sessionId, token);
    const key = hash(body.requestId);
    const fingerprint = hash(JSON.stringify(body));
    const old = session.requests?.[key];
    if (old && old.hash !== fingerprint) throw new VoiceError(409, 'Request ID already used for another input.', 'request_conflict');
    if (old?.failure) throw new VoiceError(old.failure.status, old.failure.message, old.failure.code);
    if (old?.response) return old.response;
    await this.limit(`turn-${session.roomCode}`, 30);
    const ref = this.db.ref(`voiceSessions/sessions/${body.sessionId}`);
    const owner = id();
    const until = Math.min(this.now() + LEASE_MS, session.expiresAt);
    const claim = await ref.transaction((s: Session | null) => {
      if (!s || s.expiresAt <= this.now() || (s.lock && (s.lock.until > this.now() || s.lock.requestId !== key)) ||
        (s.requests?.[key] && s.requests[key].hash !== fingerprint) || (!s.requests?.[key] && Object.keys(s.requests ?? {}).length >= 100)) return;
      if (s.requests?.[key]?.response) return;
      s.lock = { requestId: key, owner, until };
      s.requests = { ...s.requests, [key]: s.requests?.[key] ?? { hash: fingerprint } };
      return s;
    });
    if (!claim.committed) fail(409, 'A turn is pending. Retry its request ID or start a new session.');
    const state = claim.snapshot.val() as Session;
    let plan = state.requests![key].plan;
    let intentSaved = !!plan;
    try {
      if (!plan) {
        plan = await this.plan(state, body);
        if (plan.video) plan.queueKey = this.db.ref(`rooms/${state.roomCode}/queue`).push().key!;
        const saved = await ref.transaction((s: Session | null) => {
          if (!s || s.lock?.owner !== owner || s.lock.until <= this.now()) return;
          s.requests![key].plan = plan;
          return s;
        });
        if (!saved.committed) fail(409, 'Turn timed out. Retry this request.');
        intentSaved = true;
      }
      await this.authenticate(body.sessionId, token);
      let response: VoiceTurnResponse = { ...plan!.response, ...(plan!.consume ? { clearResults: true } : {}) };
      if (plan!.video) {
        const receipt = await this.command(state, hash(`${body.sessionId}:${key}`), plan!.video, plan!.queueKey!, until);
        response = { reply: state.language === 'en' ? `${receipt.status === 'started' ? 'Starting' : 'Added to queue:'} ${receipt.video.title}` : `${receipt.status === 'started' ? 'Đang bắt đầu:' : 'Đã thêm vào hàng chờ:'} ${receipt.video.title}`, receipt };
      }
      const completed = await ref.transaction((s: Session | null) => {
        if (!s || s.lock?.owner !== owner) return;
        s.requests![key] = { hash: fingerprint, response };
        if (plan!.consume) delete s.results;
        if (plan!.results) s.results = plan!.results;
        if (plan!.pending) s.pending = plan!.pending;
        else if (plan!.pending === null) delete s.pending;
        if (plan!.requester) s.requester = plan!.requester;
        s.history = [...(s.history ?? []).slice(-10),
          { role: 'user', content: body.text ?? `Choose result ${body.selection!.position} from ${body.selection!.searchId}` },
          { role: 'assistant', content: response.reply }];
        delete s.lock;
        return s;
      });
      if (!completed.committed) fail(409, 'Turn completion pending. Retry this request.');
      return response;
    } catch (error) {
      // Keep unknown outcomes pinned to their original intent, but allow the same
      // request to recover immediately once this worker has stopped executing.
      await ref.transaction((s: Session | null) => {
        if (!s || s.lock?.owner !== owner) return;
        if (error instanceof VoiceError && ((!intentSaved && !s.requests?.[key]?.plan && error.status < 500) || error.code === 'command_rejected')) {
          s.requests![key].failure = { status: error.status, message: error.message, code: error.code };
          delete s.lock;
        } else s.lock.until = 0;
        return s;
      });
      throw error;
    }
  }

  private async command(session: Session, key: string, video: YouTubeVideo, queueKey: string, deadline: number): Promise<VoiceReceipt> {
    const ref = this.db.ref(`rooms/${session.roomCode}`);
    // Warm the transaction cache: an initial null callback must not create a room.
    await ref.once('value');
    const result = await ref.transaction((room: Room | null) => {
      if (!room || (room.lastEndedAt ?? 0) !== session.epoch || this.now() >= deadline || this.now() >= session.expiresAt) return;
      // A scalar ledger lets RTDB rules compare the entire value at the parent
      // write grant, including deletes (child validation alone cannot do that).
      const ledger: Receipts = JSON.parse(room.voiceReceipts ?? '{}');
      if (ledger[key]) return room;
      if (room.requesterPromptEnabled !== false && !video.requesterName) return;
      const receipts = Object.fromEntries(Object.entries(ledger).filter(([, value]) => value.expiresAt > this.now()));
      if (Object.keys(receipts).length >= 2000 || Object.keys(room.queue ?? {}).length >= 500) return;
      const status = room.currentPlaying ? 'queued' : 'started';
      if (status === 'started') { room.currentPlaying = video; room.isPlaying = true; }
      else room.queue = { ...room.queue, [queueKey]: video };
      room.voiceReceipts = JSON.stringify({ ...receipts, [key]: { status, expiresAt: session.expiresAt } });
      return room;
    });
    if (!result.committed) throw new VoiceError(409, 'Room changed or turn expired. Please choose again.', 'command_rejected');
    return { status: (JSON.parse(result.snapshot.val().voiceReceipts) as Receipts)[key].status, video };
  }
}

function trustedVideo(video: YouTubeVideo): YouTubeVideo {
  const fields = { id: 64, title: 500, channel: 200, thumbnail: 500, duration: 16 } as const;
  const result = {} as YouTubeVideo;
  for (const [field, max] of Object.entries(fields)) {
    const key = field as keyof typeof fields;
    if (typeof video[key] !== 'string' || video[key].length > max) fail(502, 'Invalid search result.');
    result[key] = video[key];
  }
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(result.id)) fail(502, 'Invalid video ID.');
  return result;
}
