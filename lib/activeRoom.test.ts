// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('firebase/database', () => {
  const removeMock = vi.fn().mockResolvedValue(undefined);
  const cancelMock = vi.fn().mockResolvedValue(undefined);
  const onDisconnectMock = vi.fn(() => ({ remove: removeMock, cancel: cancelMock }));
  const setMock = vi.fn().mockResolvedValue(undefined);
  const removeFnMock = vi.fn().mockResolvedValue(undefined);
  const onValueMock = vi.fn(() => () => {});

  return {
    ref: vi.fn((_db: unknown, path: string) => ({ path })),
    set: setMock,
    remove: removeFnMock,
    onDisconnect: onDisconnectMock,
    onValue: onValueMock,
    // Store refs so we can access them in tests
    __mocks__: {
      setMock,
      removeFnMock,
      removeMock,
      cancelMock,
      onDisconnectMock,
      onValueMock,
    },
  };
});

import { activateRoom, deactivateRoom, subscribeActiveRooms } from './activeRoom';
import * as firebaseDb from 'firebase/database';

interface FirebaseDbMocks {
  setMock: ReturnType<typeof vi.fn>;
  removeFnMock: ReturnType<typeof vi.fn>;
  removeMock: ReturnType<typeof vi.fn>;
  cancelMock: ReturnType<typeof vi.fn>;
  onDisconnectMock: ReturnType<typeof vi.fn>;
  onValueMock: ReturnType<typeof vi.fn>;
}

const firebaseDbMocks = (firebaseDb as unknown as { __mocks__: FirebaseDbMocks }).__mocks__;

beforeEach(() => {
  firebaseDbMocks.setMock.mockReset().mockResolvedValue(undefined);
  firebaseDbMocks.removeFnMock.mockReset().mockResolvedValue(undefined);
  firebaseDbMocks.removeMock.mockReset().mockResolvedValue(undefined);
  firebaseDbMocks.cancelMock.mockReset().mockResolvedValue(undefined);
  firebaseDbMocks.onDisconnectMock.mockReset().mockReturnValue({
    remove: firebaseDbMocks.removeMock,
    cancel: firebaseDbMocks.cancelMock,
  });
  firebaseDbMocks.onValueMock.mockReset().mockReturnValue(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('activateRoom', () => {
  it('sets meta/activeRooms/{code} to true and registers onDisconnect remove', async () => {
    const cleanup = await activateRoom('5678');
    expect(firebaseDbMocks.setMock).toHaveBeenCalledWith({ path: 'meta/activeRooms/5678' }, true);
    expect(firebaseDbMocks.onDisconnectMock).toHaveBeenCalledWith({
      path: 'meta/activeRooms/5678',
    });
    expect(firebaseDbMocks.removeMock).toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');
  });

  it('cleanup cancels onDisconnect and removes the presence node', async () => {
    const cleanup = await activateRoom('5678');
    await cleanup();
    expect(firebaseDbMocks.cancelMock).toHaveBeenCalled();
    expect(firebaseDbMocks.removeFnMock).toHaveBeenCalledWith({ path: 'meta/activeRooms/5678' });
  });
});

describe('deactivateRoom', () => {
  it('removes meta/activeRooms/{code}', async () => {
    await deactivateRoom('9012');
    expect(firebaseDbMocks.removeFnMock).toHaveBeenCalledWith({ path: 'meta/activeRooms/9012' });
  });
});

describe('subscribeActiveRooms', () => {
  it('calls cb with empty array when snapshot has no data', () => {
    firebaseDbMocks.onValueMock.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ exists: () => false, val: () => null });
      return () => {};
    });
    const cb = vi.fn();
    subscribeActiveRooms(cb);
    expect(cb).toHaveBeenCalledWith([]);
  });

  it('calls cb with array of keys when snapshot has data', () => {
    firebaseDbMocks.onValueMock.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ exists: () => true, val: () => ({ '5678': true, '9012': true }) });
      return () => {};
    });
    const cb = vi.fn();
    subscribeActiveRooms(cb);
    expect(cb).toHaveBeenCalledWith(expect.arrayContaining(['5678', '9012']));
  });
});
