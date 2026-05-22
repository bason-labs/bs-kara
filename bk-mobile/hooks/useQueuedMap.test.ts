import { renderHook } from '@testing-library/react-native';
import { useQueuedMap } from './useQueuedMap';

const makeItem = (id: string, queueId: string) => ({
  id, queueId, title: 'T', channel: 'C', thumbnail: '', duration: '1:00',
});

describe('useQueuedMap', () => {
  it('returns empty map for empty queue', () => {
    const { result } = renderHook(() => useQueuedMap([]));
    expect(result.current.size).toBe(0);
  });

  it('maps each video id to its queueId', () => {
    const queue = [makeItem('vid1', 'q1'), makeItem('vid2', 'q2')];
    const { result } = renderHook(() => useQueuedMap(queue));
    expect(result.current.get('vid1')).toBe('q1');
    expect(result.current.get('vid2')).toBe('q2');
  });

  it('updates map when queue changes', () => {
    const { result, rerender } = renderHook(
      ({ queue }) => useQueuedMap(queue),
      { initialProps: { queue: [makeItem('vid1', 'q1')] } }
    );
    expect(result.current.has('vid1')).toBe(true);
    rerender({ queue: [makeItem('vid2', 'q2')] });
    expect(result.current.has('vid1')).toBe(false);
    expect(result.current.get('vid2')).toBe('q2');
  });
});
