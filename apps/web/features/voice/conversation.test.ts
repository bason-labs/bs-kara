import { describe, expect, it, vi } from 'vitest';
import { VoiceConversation, type VoiceDependencies } from './conversation';
import type { VoiceTurnResponse } from './types';

const video = { id: 'birthday', title: 'Happy Birthday', channel: 'Karaoke', duration: '2:30', thumbnail: '' };
function setup() {
  let next = 0;
  const deps: VoiceDependencies = {
    createSession: async () => ({ sessionId: 's1', token: 'secret' }),
    capture: async () => new Blob(['audio']),
    transcribe: async () => 'Happy Birthday',
    turn: vi.fn(async () => ({ reply: 'Choose one', results: { searchId: 'list1', videos: [video] } })),
    speak: async () => {},
    prime: () => {},
    id: () => `id${++next}`,
  };
  return { deps, conversation: new VoiceConversation(deps) };
}

describe('voice conversation', () => {
  it('renews expired credentials after a transcription rejection', async () => {
    const { deps, conversation } = setup();
    deps.createSession = vi.fn(async () => ({ sessionId: 'renewed', token: 'secret' }));
    deps.transcribe = vi.fn().mockRejectedValueOnce({ status: 401, code: 'session_expired' }).mockResolvedValueOnce('Happy Birthday');
    await conversation.start();
    expect(conversation.getSnapshot().error).toBe('session_expired');
    await conversation.start();
    conversation.stop();
    expect(deps.createSession).toHaveBeenCalledTimes(2);
  });
  it('clears consumed choices while retaining the transcript', async () => {
    const { deps, conversation } = setup();
    await conversation.submitText('Happy Birthday');
    deps.turn = async () => ({ reply: 'Who will sing?', clearResults: true });
    await conversation.select('list1', 1);
    expect(conversation.getSnapshot().results).toBeNull();
    expect(conversation.getSnapshot().messages).toHaveLength(4);
  });

  it('allows a new search after a definitively invalid selection', async () => {
    const { deps, conversation } = setup();
    await conversation.submitText('Happy Birthday');
    deps.turn = vi.fn().mockRejectedValueOnce({ status: 409, code: 'invalid_selection' }).mockResolvedValueOnce({ reply: 'New search' });
    await conversation.select('list1', 1);
    expect(conversation.getSnapshot().canRetry).toBe(false);
    expect(conversation.getSnapshot().results).toBeNull();
    await conversation.submitText('Another song');
    expect(deps.turn).toHaveBeenCalledTimes(2);
  });

  it('uses the displayed search snapshot and shows success only after the action resolves', async () => {
    const { deps, conversation } = setup();
    await conversation.submitText('Happy Birthday');
    let complete!: (value: VoiceTurnResponse) => void;
    deps.turn = vi.fn(() => new Promise<VoiceTurnResponse>(resolve => { complete = resolve; }));
    const selection = conversation.select('list1', 1);
    await vi.waitFor(() => expect(conversation.getSnapshot().phase).toBe('thinking'));
    expect(conversation.getSnapshot().messages.some(m => m.receipt)).toBe(false);
    complete({ reply: 'Added', receipt: { status: 'queued', video } });
    await selection;
    expect(deps.turn).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ selection: { searchId: 'list1', position: 1 } }), expect.anything());
    expect(conversation.getSnapshot().messages.at(-1)?.receipt?.video.id).toBe('birthday');
  });

  it('retries an uncertain turn using the same request ID and without duplicate user messages', async () => {
    const { deps, conversation } = setup();
    const turn = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ reply: 'Added', receipt: { status: 'queued', video } });
    deps.turn = turn;
    await conversation.submitText('First one');
    expect(conversation.getSnapshot().canRetry).toBe(true);
    await conversation.retry();
    expect(turn.mock.calls[0][1].requestId).toBe(turn.mock.calls[1][1].requestId);
    expect(conversation.getSnapshot().messages.filter(m => m.role === 'user')).toHaveLength(1);
    expect(conversation.getSnapshot().canRetry).toBe(false);
  });

  it('ignores a late response after stop and preserves the uncertain turn for reconciliation', async () => {
    const { deps, conversation } = setup();
    let complete!: (value: VoiceTurnResponse) => void;
    deps.turn = () => new Promise(resolve => { complete = resolve; });
    const pending = conversation.submitText('Add first');
    await vi.waitFor(() => expect(typeof complete).toBe('function'));
    conversation.stop();
    complete({ reply: 'Added', receipt: { status: 'queued', video } });
    await pending;
    expect(conversation.getSnapshot().messages).toHaveLength(1);
    expect(conversation.getSnapshot().canRetry).toBe(true);
  });

  it('does not accept stale or out-of-range selections', async () => {
    const { deps, conversation } = setup();
    await conversation.submitText('Happy Birthday');
    await conversation.select('old-list', 1);
    await conversation.select('list1', 2);
    expect(deps.turn).toHaveBeenCalledTimes(1);
    expect(conversation.getSnapshot().error).toBe('staleSelection');
  });

  it('stops recording when deactivated and keeps previous messages', async () => {
    const { deps, conversation } = setup();
    await conversation.submitText('Happy Birthday');
    let captureSignal: AbortSignal | undefined;
    deps.capture = ({ signal }) => { captureSignal = signal; return new Promise(() => {}); };
    void conversation.start();
    await vi.waitFor(() => expect(captureSignal).toBeDefined());
    conversation.stop();
    expect(captureSignal?.aborted).toBe(true);
    expect(conversation.getSnapshot().messages).toHaveLength(2);
    expect(conversation.getSnapshot().phase).toBe('idle');
  });

  it('does not turn a speech-output failure into a failed queue action', async () => {
    const { deps, conversation } = setup();
    deps.turn = async () => ({ reply: 'Added', receipt: { status: 'queued', video } });
    deps.speak = async () => { throw new Error('audio'); };
    await conversation.submitText('First');
    expect(conversation.getSnapshot().messages.at(-1)?.receipt?.status).toBe('queued');
    expect(conversation.getSnapshot().error).toBe('speech');
    expect(conversation.getSnapshot().canRetry).toBe(false);
  });
});
