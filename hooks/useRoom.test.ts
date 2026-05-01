import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));

const refMock = vi.fn((_db: unknown, path: string) => ({ path }));
const onValueMock = vi.fn();
const setMock = vi.fn().mockResolvedValue(undefined);
const removeMock = vi.fn().mockResolvedValue(undefined);
const updateMock = vi.fn().mockResolvedValue(undefined);
const pushMock = vi.fn();
const runTransactionMock = vi.fn();
const getMock = vi.fn();

vi.mock('firebase/database', () => ({
  ref: (...args: unknown[]) => refMock(...(args as [unknown, string])),
  onValue: (...args: unknown[]) => onValueMock(...args),
  set: (...args: unknown[]) => setMock(...args),
  remove: (...args: unknown[]) => removeMock(...args),
  update: (...args: unknown[]) => updateMock(...args),
  push: (...args: unknown[]) => pushMock(...args),
  runTransaction: (...args: unknown[]) => runTransactionMock(...args),
  get: (...args: unknown[]) => getMock(...args),
  onChildAdded: vi.fn(),
  query: vi.fn(),
  orderByChild: vi.fn(),
  startAfter: vi.fn(),
  onDisconnect: vi.fn(),
}));

import { useRoom } from './useRoom';

type Listener = (snap: { val: () => unknown }) => void;
let activeListener: Listener | null = null;

beforeEach(() => {
  activeListener = null;
  refMock.mockClear();
  setMock.mockClear();
  removeMock.mockClear();
  updateMock.mockClear();
  pushMock.mockReset();
  runTransactionMock.mockReset();
  getMock.mockReset();
  onValueMock.mockReset().mockImplementation((_ref: unknown, listener: Listener) => {
    activeListener = listener;
    return () => {};
  });
});

afterEach(() => vi.restoreAllMocks());

function emit(value: unknown) {
  act(() => {
    activeListener?.({ val: () => value });
  });
}

describe('useRoom subscription', () => {
  it('parses queue, history, and playedHistory from a snapshot', async () => {
    const { result } = renderHook(() => useRoom('1234'));
    emit({
      queue: { q1: { id: 'a', title: 'A', channel: '', thumbnail: '', duration: '' } },
      history: { 0: { id: 'h0', title: 'H0', channel: '', thumbnail: '', duration: '' } },
      playedHistory: { 0: 'p0', 1: 'p1' },
      currentPlaying: { id: 'cur', title: 'Cur', channel: '', thumbnail: '', duration: '' },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.roomData.queue).toHaveLength(1);
    expect(result.current.roomData.queue[0]).toMatchObject({ id: 'a', queueId: 'q1' });
    expect(result.current.roomData.history).toEqual([
      { id: 'h0', title: 'H0', channel: '', thumbnail: '', duration: '' },
    ]);
    expect(result.current.roomData.playedHistory).toEqual(['p0', 'p1']);
    expect(result.current.roomData.currentPlaying?.id).toBe('cur');
  });

  it('reads the legacy isAImcEnabled field when isMCEnabled is missing', () => {
    const { result } = renderHook(() => useRoom('1234'));
    emit({ isAImcEnabled: false });
    expect(result.current.roomData.isMCEnabled).toBe(false);
  });

  it('marks roomExists=false when the snapshot is null', async () => {
    const { result } = renderHook(() => useRoom('1234'));
    emit(null);
    await waitFor(() => expect(result.current.roomExists).toBe(false));
  });

  it('clears state and unsubscribes when roomId becomes null', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useRoom(id),
      { initialProps: { id: '1234' as string | null } },
    );
    rerender({ id: null });
    expect(result.current.roomData.queue).toEqual([]);
    expect(result.current.roomExists).toBeNull();
  });
});

describe('useRoom mutations', () => {
  it('addSongToQueue strips undefined requesterName from the payload', () => {
    pushMock.mockReturnValue({ key: 'newKey' });
    const { result } = renderHook(() => useRoom('1234'));
    emit({});
    act(() => {
      result.current.addSongToQueue({
        id: 'v',
        title: 't',
        channel: 'c',
        thumbnail: '',
        duration: '',
      });
    });
    const payload = pushMock.mock.calls[0][1];
    expect(payload).not.toHaveProperty('requesterName');
    expect(payload).toMatchObject({ id: 'v', title: 't' });
  });

  it('addSongToQueue includes requesterName when it is non-empty', () => {
    pushMock.mockReturnValue({ key: 'k1' });
    const { result } = renderHook(() => useRoom('1234'));
    emit({});
    act(() => {
      result.current.addSongToQueue(
        { id: 'v', title: 't', channel: '', thumbnail: '', duration: '' },
        '  Alice  ',
      );
    });
    expect(pushMock.mock.calls[0][1]).toMatchObject({ requesterName: 'Alice' });
  });

  it('playNext promotes queue[0] when the queue is non-empty', async () => {
    pushMock.mockReturnValue({ key: 'k' });
    const { result } = renderHook(() => useRoom('1234'));
    emit({
      queue: { q1: { id: 'next', title: 'Next', channel: '', thumbnail: '', duration: '' } },
      currentPlaying: { id: 'cur', title: 'Cur', channel: '', thumbnail: '', duration: '' },
      history: {},
    });
    await act(async () => {
      await result.current.playNext();
    });
    const setCalls = setMock.mock.calls.map(([r]) => (r as { path: string }).path);
    expect(setCalls).toContain('rooms/1234/currentPlaying');
    expect(setCalls).toContain('rooms/1234/history');
    expect(removeMock.mock.calls.some(([r]) =>
      (r as { path: string }).path.startsWith('rooms/1234/queue/'),
    )).toBe(true);
  });

  it('playNext clears currentPlaying when the queue is empty', async () => {
    const { result } = renderHook(() => useRoom('1234'));
    emit({
      queue: {},
      currentPlaying: { id: 'cur', title: 'Cur', channel: '', thumbnail: '', duration: '' },
      history: {},
    });
    await act(async () => {
      await result.current.playNext();
    });
    expect(removeMock.mock.calls.some(([r]) =>
      (r as { path: string }).path === 'rooms/1234/currentPlaying',
    )).toBe(true);
  });

  it('resetRoom writes a fresh lastEndedAt timestamp', async () => {
    const { result } = renderHook(() => useRoom('1234'));
    emit({});
    await act(async () => {
      await result.current.resetRoom();
    });
    const lastEndedCall = setMock.mock.calls.find(([r]) =>
      (r as { path: string }).path === 'rooms/1234/lastEndedAt',
    );
    expect(lastEndedCall).toBeDefined();
    expect(typeof lastEndedCall![1]).toBe('number');
  });

  it('tryClaimAnnouncementLock returns committed value from the transaction', async () => {
    runTransactionMock.mockResolvedValue({ committed: true });
    const { result } = renderHook(() => useRoom('1234'));
    emit({});
    let won: boolean | undefined;
    await act(async () => {
      won = await result.current.tryClaimAnnouncementLock('s1');
    });
    expect(won).toBe(true);
  });

  it('tryClaimAnnouncementLock returns false when the value already matches', async () => {
    runTransactionMock.mockResolvedValue({ committed: false });
    const { result } = renderHook(() => useRoom('1234'));
    emit({});
    let won: boolean | undefined;
    await act(async () => {
      won = await result.current.tryClaimAnnouncementLock('s1');
    });
    expect(won).toBe(false);
  });

  it('removeSong issues a remove on rooms/{id}/queue/{songId}', () => {
    const { result } = renderHook(() => useRoom('1234'));
    emit({});
    act(() => result.current.removeSong('q1'));
    expect(removeMock).toHaveBeenCalledWith({ path: 'rooms/1234/queue/q1' });
  });

  it('mutators are no-ops when roomId is null', () => {
    const { result } = renderHook(() => useRoom(null));
    act(() => result.current.removeSong('q1'));
    act(() =>
      result.current.addSongToQueue({
        id: 'v',
        title: 't',
        channel: '',
        thumbnail: '',
        duration: '',
      }),
    );
    expect(removeMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
