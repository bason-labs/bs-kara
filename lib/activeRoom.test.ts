import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/database', () => ({
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  runTransaction: vi.fn(),
  get: vi.fn(),
  onValue: vi.fn(),
}));

import { get, onValue, runTransaction } from 'firebase/database';
import {
  claimOrGetActiveRoom,
  clearActiveRoomIfMatches,
  getActiveRoom,
  subscribeActiveRoom,
} from './activeRoom';

const runTx = runTransaction as unknown as ReturnType<typeof vi.fn>;
const getMock = get as unknown as ReturnType<typeof vi.fn>;
const onValueMock = onValue as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  runTx.mockReset();
  getMock.mockReset();
  onValueMock.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe('claimOrGetActiveRoom', () => {
  it('returns whichever code the transaction commits', async () => {
    runTx.mockResolvedValue({ snapshot: { val: () => '4242' } });
    const code = await claimOrGetActiveRoom();
    expect(code).toBe('4242');
    expect(runTx).toHaveBeenCalledTimes(1);
  });

  it('passes the generated candidate when no current value exists', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // → 1000
    runTx.mockImplementation(async (_ref: unknown, updater: (cur: unknown) => unknown) => {
      const result = updater(null);
      return { snapshot: { val: () => result } };
    });
    const code = await claimOrGetActiveRoom();
    expect(code).toBe('1000');
  });

  it('keeps the existing value when the path already has one', async () => {
    runTx.mockImplementation(async (_ref: unknown, updater: (cur: unknown) => unknown) => {
      const result = updater('9999');
      // Updater returning undefined aborts → snapshot keeps original.
      const next = result === undefined ? '9999' : result;
      return { snapshot: { val: () => next } };
    });
    const code = await claimOrGetActiveRoom();
    expect(code).toBe('9999');
  });
});

describe('getActiveRoom', () => {
  it('returns the value when the snapshot exists', async () => {
    getMock.mockResolvedValue({ exists: () => true, val: () => '1234' });
    expect(await getActiveRoom()).toBe('1234');
  });

  it('returns null when the snapshot is missing', async () => {
    getMock.mockResolvedValue({ exists: () => false, val: () => null });
    expect(await getActiveRoom()).toBeNull();
  });
});

describe('clearActiveRoomIfMatches', () => {
  it('returns null from the updater when the current value matches', async () => {
    let received: unknown;
    runTx.mockImplementation(async (_ref: unknown, updater: (cur: unknown) => unknown) => {
      received = updater('1234');
      return { snapshot: { val: () => null } };
    });
    await clearActiveRoomIfMatches('1234');
    expect(received).toBeNull();
  });

  it('aborts (returns undefined) when the current value differs', async () => {
    let received: unknown = 'untouched';
    runTx.mockImplementation(async (_ref: unknown, updater: (cur: unknown) => unknown) => {
      received = updater('9999');
      return { snapshot: { val: () => '9999' } };
    });
    await clearActiveRoomIfMatches('1234');
    expect(received).toBeUndefined();
  });
});

describe('subscribeActiveRoom', () => {
  it('forwards snapshot existence/value into the callback', () => {
    const cb = vi.fn();
    onValueMock.mockImplementation((_ref: unknown, listener: (snap: unknown) => void) => {
      listener({ exists: () => true, val: () => '4242' });
      listener({ exists: () => false, val: () => null });
      return () => {};
    });
    subscribeActiveRoom(cb);
    expect(cb).toHaveBeenNthCalledWith(1, '4242');
    expect(cb).toHaveBeenNthCalledWith(2, null);
  });

  it('returns the unsubscribe function from onValue', () => {
    const unsub = vi.fn();
    onValueMock.mockReturnValue(unsub);
    expect(subscribeActiveRoom(() => {})).toBe(unsub);
  });
});
