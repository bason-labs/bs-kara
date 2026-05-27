import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultOrOpts?: unknown, opts?: Record<string, unknown>) => {
      // resolve actual options: t(key, opts) or t(key, defaultValue, opts)
      const resolvedOpts: Record<string, unknown> =
        (opts != null ? opts : typeof defaultOrOpts === 'object' && defaultOrOpts !== null ? (defaultOrOpts as Record<string, unknown>) : {});
      if (key === 'toast.queuePositionEta')
        return `Vị trí thứ ${resolvedOpts.pos} · ~${resolvedOpts.eta} phút nữa`;
      const map: Record<string, string> = {
        'toast.undo':           'Hoàn tác',
        'addedToast.added':     'Đã thêm',
        'addedToast.viewQueue': 'Xem DS',
      };
      return map[key] ?? key;
    },
  }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));

import { AddedToast } from './AddedToast';

const video = { id: 'v1', title: 'Test Song', channel: 'Ch', thumbnail: 'https://img', duration: '3:00' };

describe('AddedToast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('calls onDismiss after 3800ms', () => {
    const onDismiss = jest.fn();
    render(<AddedToast video={video} onViewQueue={jest.fn()} onDismiss={onDismiss} />);
    act(() => { jest.advanceTimersByTime(3800); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss before 3800ms (regression: was 2500ms)', () => {
    const onDismiss = jest.fn();
    render(<AddedToast video={video} onViewQueue={jest.fn()} onDismiss={onDismiss} />);
    act(() => { jest.advanceTimersByTime(2500); });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('shows queue position with ETA when queuePos provided', () => {
    const { getByText } = render(
      <AddedToast video={video} onViewQueue={jest.fn()} onDismiss={jest.fn()} queuePos={3} />
    );
    expect(getByText('Vị trí thứ 3 · ~12 phút nữa')).toBeTruthy();
  });

  it('calls onUndo when undo button pressed', () => {
    const onUndo = jest.fn();
    const { getByText } = render(
      <AddedToast video={video} onViewQueue={jest.fn()} onDismiss={jest.fn()} onUndo={onUndo} />
    );
    fireEvent.press(getByText('Hoàn tác'));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('hides undo button when onUndo not provided', () => {
    const { queryByText } = render(
      <AddedToast video={video} onViewQueue={jest.fn()} onDismiss={jest.fn()} />
    );
    expect(queryByText('Hoàn tác')).toBeNull();
  });
});
