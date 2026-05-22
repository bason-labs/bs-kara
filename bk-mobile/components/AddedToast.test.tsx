import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AddedToast } from './AddedToast';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'addedToast.added': 'Đã thêm vào danh sách',
        'addedToast.viewQueue': 'Xem DS',
      };
      return map[key] ?? key;
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));

const mockVideo = {
  id: 'vid1', title: 'Bước Qua Đời Nhau Karaoke', channel: 'Test',
  thumbnail: 'https://img.youtube.com/vi/vid1/mqdefault.jpg', duration: '4:00',
};

describe('AddedToast', () => {
  it('renders the song title', () => {
    const { getByText } = render(
      <AddedToast video={mockVideo} onViewQueue={jest.fn()} onDismiss={jest.fn()} />
    );
    expect(getByText('Bước Qua Đời Nhau Karaoke')).toBeTruthy();
  });

  it('renders the added badge', () => {
    const { getByText } = render(
      <AddedToast video={mockVideo} onViewQueue={jest.fn()} onDismiss={jest.fn()} />
    );
    expect(getByText('Đã thêm vào danh sách')).toBeTruthy();
  });

  it('calls onViewQueue when Xem DS is tapped', () => {
    const onViewQueue = jest.fn();
    const onDismiss = jest.fn();
    const { getByText } = render(
      <AddedToast video={mockVideo} onViewQueue={onViewQueue} onDismiss={onDismiss} />
    );
    fireEvent.press(getByText('Xem DS'));
    expect(onViewQueue).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when toast card is tapped', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <AddedToast video={mockVideo} onViewQueue={jest.fn()} onDismiss={onDismiss} />
    );
    fireEvent.press(getByTestId('toast-card'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after 2500ms', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    render(<AddedToast video={mockVideo} onViewQueue={jest.fn()} onDismiss={onDismiss} />);
    act(() => { jest.advanceTimersByTime(2500); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
