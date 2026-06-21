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
    getDatabase: vi.fn(),
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
  sessionStorage.clear();
});

describe('useTVPresence — URL param activation', () => {
  it('activates directly from ?room= URL param', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?room=5678' },
      writable: true,
    });
    const { result } = renderHook(() => useTVPresence());
    await act(async () => {});
    expect(result.current.phase).toBe('active');
    expect(result.current.roomCode).toBe('5678');
    window.location.search = '';
  });

  it('falls back to sessionStorage when no URL param', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
    });
    sessionStorage.setItem('karaoke_tv_room', '9999');
    const { result } = renderHook(() => useTVPresence());
    await act(async () => {});
    expect(result.current.phase).toBe('active');
    expect(result.current.roomCode).toBe('9999');
  });

  it('shows lookup form when neither URL param nor sessionStorage present', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
    });
    const { result } = renderHook(() => useTVPresence());
    await act(async () => {});
    expect(result.current.phase).toBe('lookup');
    expect(result.current.roomCode).toBeNull();
  });
});

describe('useTVPresence — activateRoomByCode', () => {
  it('activates the room without writing guestsAllowed', async () => {
    const { result } = renderHook(() => useTVPresence());
    await act(async () => {
      await result.current.activateRoomByCode('1234');
    });
    expect(result.current.phase).toBe('active');
    expect(result.current.roomCode).toBe('1234');
    const paths = refMock.mock.calls.map((call) => call[1] as string | undefined);
    expect(paths).not.toContain('rooms/1234/guestsAllowed');
  });
});
