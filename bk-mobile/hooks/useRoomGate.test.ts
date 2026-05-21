import { renderHook, act } from '@testing-library/react-native';
import { useRoomGate } from './useRoomGate';

let activeRoomsCallback: (codes: string[]) => void;
let unsubCalled = false;

jest.mock('@bs-kara/shared', () => ({
  subscribeActiveRooms: (cb: (codes: string[]) => void) => {
    activeRoomsCallback = cb;
    return () => { unsubCalled = true; };
  },
}));

describe('useRoomGate', () => {
  beforeEach(() => { unsubCalled = false; });

  it('starts loading with no active room', () => {
    const { result } = renderHook(() => useRoomGate());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.activeRoomCode).toBeNull();
  });

  it('returns first active room code when rooms become available', () => {
    const { result } = renderHook(() => useRoomGate());
    act(() => { activeRoomsCallback(['1234']); });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.activeRoomCode).toBe('1234');
  });

  it('returns null when no rooms are active', () => {
    const { result } = renderHook(() => useRoomGate());
    act(() => { activeRoomsCallback([]); });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.activeRoomCode).toBeNull();
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useRoomGate());
    act(() => { activeRoomsCallback([]); });
    unmount();
    expect(unsubCalled).toBe(true);
  });
});
