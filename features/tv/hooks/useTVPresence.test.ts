import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('@/lib/registeredUsers', () => ({
  lookupUserByCode: vi.fn(),
  lookupUserByPhone: vi.fn(),
}));
vi.mock('@/lib/publicOrigin', () => ({ getPublicOrigin: vi.fn(() => 'http://localhost:3000') }));
vi.mock('firebase/database', () => {
  const setMock = vi.fn().mockResolvedValue(undefined);
  const removeMock = vi.fn().mockResolvedValue(undefined);
  const onDisconnectObj = {
    remove: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  const refMock = vi.fn((_, path?: string) => ({ _path: path }));
  return {
    ref: refMock,
    set: setMock,
    remove: removeMock,
    onDisconnect: vi.fn(() => onDisconnectObj),
  };
});

import { renderHook, act } from '@testing-library/react';
import * as firebaseDb from 'firebase/database';
import { useTVPresence } from './useTVPresence';

const setMock = firebaseDb.set as ReturnType<typeof vi.fn>;
const refMock = firebaseDb.ref as ReturnType<typeof vi.fn>;

beforeEach(() => {
  setMock.mockClear();
  refMock.mockClear();
  (firebaseDb.remove as ReturnType<typeof vi.fn>).mockClear();
  localStorage.clear();
});

describe('useTVPresence — guestsAllowed', () => {
  it('activateRoomByCode writes guestsAllowed=false before activating', async () => {
    const { result } = renderHook(() => useTVPresence());
    await act(async () => {
      await result.current.activateRoomByCode('1234');
    });
    // ref should have been called with the guestsAllowed path
    const paths = refMock.mock.calls.map((call) => call[1] as string | undefined);
    expect(paths).toContain('rooms/1234/guestsAllowed');
    // set should have been called with false for that path
    const idx = refMock.mock.calls.findIndex((c) => c[1] === 'rooms/1234/guestsAllowed');
    expect(setMock.mock.calls[idx]?.[1]).toBe(false);
  });

  it('setGuestsAllowed(true) writes true to rooms/{roomCode}/guestsAllowed', async () => {
    const { result } = renderHook(() => useTVPresence());
    await act(async () => {
      await result.current.activateRoomByCode('1234');
    });
    setMock.mockClear();
    refMock.mockClear();
    act(() => { result.current.setGuestsAllowed(true); });
    const paths = refMock.mock.calls.map((c) => c[1] as string | undefined);
    expect(paths).toContain('rooms/1234/guestsAllowed');
    expect(setMock).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('setGuestsAllowed is a no-op when no room is active', () => {
    const { result } = renderHook(() => useTVPresence());
    act(() => { result.current.setGuestsAllowed(true); });
    expect(setMock).not.toHaveBeenCalled();
  });
});
