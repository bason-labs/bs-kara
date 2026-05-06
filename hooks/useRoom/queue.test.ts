/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/database', () => ({
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  push: vi.fn(),
  remove: vi.fn(),
  set: vi.fn(),
  runTransaction: vi.fn(),
  update: vi.fn(),
}));

import { update as updateMock } from 'firebase/database';
import { useRoomQueue } from './queue';
import { DEFAULT_STATE, type RoomState } from './types';
import type { QueueItem, YouTubeVideo } from '@/lib/youtube/types';

const updateFn = updateMock as unknown as ReturnType<typeof vi.fn>;

const ROOM_ID = '1234';

function makeVideo(over: Partial<YouTubeVideo> = {}): YouTubeVideo {
  return {
    id: 'vid-x',
    title: 'Song X',
    channel: 'Channel X',
    thumbnail: 'https://example.com/x.jpg',
    duration: '3:00',
    ...over,
  };
}

function makeQueueItem(over: Partial<QueueItem>): QueueItem {
  return {
    id: 'q-vid',
    title: 'Queue Song',
    channel: 'Q Channel',
    thumbnail: 'https://example.com/q.jpg',
    duration: '2:30',
    queueId: 'qid-1',
    ...over,
  };
}

function renderQueueHook(initial: Partial<RoomState>) {
  const generateMC = vi.fn().mockResolvedValue(undefined);
  return renderHook(() => {
    const roomDataRef = useRef<RoomState>({ ...DEFAULT_STATE, ...initial });
    return useRoomQueue(ROOM_ID, roomDataRef, generateMC);
  });
}

beforeEach(() => updateFn.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('playSongNow', () => {
  it('writes only currentPlaying + isPlaying when nothing is playing (no history, no queue write)', async () => {
    const { result } = renderQueueHook({
      currentPlaying: null,
      queue: [],
      history: [],
    });
    updateFn.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.playSongNow(makeVideo({ id: 'pick' }));
    });

    expect(updateFn).toHaveBeenCalledTimes(1);
    const [refArg, payload] = updateFn.mock.calls[0];
    expect((refArg as { path: string }).path).toBe(`rooms/${ROOM_ID}`);
    expect(payload).toEqual({
      currentPlaying: expect.objectContaining({ id: 'pick' }),
      isPlaying: true,
    });
  });

  it('appends the previous currentPlaying to /history (skip-and-replace)', async () => {
    const previous = makeVideo({
      id: 'old-current',
      title: 'Old Current',
      requesterName: 'Alice',
    });
    const existingHistory = [makeVideo({ id: 'h1' }), makeVideo({ id: 'h2' })];
    const { result } = renderQueueHook({
      currentPlaying: previous,
      queue: [],
      history: existingHistory,
    });
    updateFn.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.playSongNow(makeVideo({ id: 'pick-from-search' }));
    });

    const [, payload] = updateFn.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(payload.currentPlaying).toEqual(
      expect.objectContaining({ id: 'pick-from-search' }),
    );
    expect(payload.isPlaying).toBe(true);
    // /history is rewritten as an index-keyed record with the displaced
    // song appended at the tail — playPrevious pops the last entry.
    const history = payload.history as Record<number, YouTubeVideo>;
    const historyIds = Object.values(history).map((v) => v.id);
    expect(historyIds).toEqual(['h1', 'h2', 'old-current']);
    expect(history[2]).toMatchObject({ requesterName: 'Alice' });
    // The previous song is NOT prepended to the queue — the spec changed
    // and Play Now must behave like Skip + Replace.
    expect(payload).not.toHaveProperty('queue');
  });

  it('removes only the picked queue entry; the rest of /queue is not touched', async () => {
    const previous = makeVideo({ id: 'old-current' });
    const picked = makeQueueItem({ id: 'picked-vid', queueId: 'qid-picked' });
    const otherA = makeQueueItem({ id: 'still-queued-a', queueId: 'qid-a' });
    const otherB = makeQueueItem({ id: 'still-queued-b', queueId: 'qid-b' });
    const { result } = renderQueueHook({
      currentPlaying: previous,
      queue: [otherA, picked, otherB],
      history: [],
    });
    updateFn.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.playSongNow(picked, picked.queueId);
    });

    expect(updateFn).toHaveBeenCalledTimes(1);
    const [, payload] = updateFn.mock.calls[0] as [unknown, Record<string, unknown>];
    // Atomic single-entry removal — no full-queue rewrite, no reorder.
    expect(payload[`queue/${picked.queueId}`]).toBeNull();
    // No top-level /queue write means qid-a and qid-b stay exactly where
    // they were, untouched by Firebase.
    expect(payload).not.toHaveProperty('queue');
    // And no other path under /queue is referenced — only the picked one.
    const queueKeys = Object.keys(payload).filter((k) => k.startsWith('queue/'));
    expect(queueKeys).toEqual([`queue/${picked.queueId}`]);
  });

  it('is a no-op when the picked song is already currentPlaying', async () => {
    const playing = makeVideo({ id: 'same' });
    const { result } = renderQueueHook({
      currentPlaying: playing,
      queue: [],
    });

    await act(async () => {
      await result.current.playSongNow(makeVideo({ id: 'same' }));
    });

    expect(updateFn).not.toHaveBeenCalled();
  });
});
