import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/database', () => ({
  ref: vi.fn(() => ({})),
  onValue: vi.fn(),
}));

import { renderHook, act } from '@testing-library/react';
import * as firebaseDatabase from 'firebase/database';
import { useRoomSubscribe } from './subscribe';

const onValueMock = firebaseDatabase.onValue as ReturnType<typeof vi.fn>;

function triggerSnapshot(val: unknown) {
  const callback = onValueMock.mock.calls[onValueMock.mock.calls.length - 1][1];
  act(() => { callback({ val: () => val, exists: () => val !== null }); });
}

beforeEach(() => {
  onValueMock.mockClear();
  onValueMock.mockReturnValue(() => {});
});

describe('useRoomSubscribe — hostUid', () => {
  it('defaults hostUid to null when field is missing', () => {
    const { result } = renderHook(() => useRoomSubscribe('1234'));
    triggerSnapshot({ isPlaying: true });
    expect(result.current.roomData.hostUid).toBeNull();
  });

  it('maps hostUid from the snapshot', () => {
    const { result } = renderHook(() => useRoomSubscribe('1234'));
    triggerSnapshot({ hostUid: 'uid-abc' });
    expect(result.current.roomData.hostUid).toBe('uid-abc');
  });
});

describe('useRoomSubscribe — guestCanRemove', () => {
  it('defaults guestCanRemove to false when field is missing', () => {
    const { result } = renderHook(() => useRoomSubscribe('1234'));
    triggerSnapshot({ isPlaying: true });
    expect(result.current.roomData.guestCanRemove).toBe(false);
  });

  it('maps guestCanRemove: true from the snapshot', () => {
    const { result } = renderHook(() => useRoomSubscribe('1234'));
    triggerSnapshot({ guestCanRemove: true });
    expect(result.current.roomData.guestCanRemove).toBe(true);
  });
});

describe('useRoomSubscribe — guestsAllowed', () => {
  it('defaults guestsAllowed to false when field is missing', () => {
    const { result } = renderHook(() => useRoomSubscribe('1234'));
    triggerSnapshot({ isPlaying: true });
    expect(result.current.roomData.guestsAllowed).toBe(false);
  });

  it('maps guestsAllowed: true from the snapshot', () => {
    const { result } = renderHook(() => useRoomSubscribe('1234'));
    triggerSnapshot({ guestsAllowed: true });
    expect(result.current.roomData.guestsAllowed).toBe(true);
  });

  it('maps guestsAllowed: false from the snapshot', () => {
    const { result } = renderHook(() => useRoomSubscribe('1234'));
    triggerSnapshot({ guestsAllowed: false });
    expect(result.current.roomData.guestsAllowed).toBe(false);
  });
});
