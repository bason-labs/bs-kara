// mocks first
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'search.statusQueued') return `Hàng chờ #${params?.pos ?? ''}`;
      const map: Record<string, string> = {
        'search.statusNowPlaying': 'Đang phát',
      };
      return map[key] ?? key;
    },
  }),
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('./EQBars', () => ({
  EQBars: () => null,
}));

// then imports
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SongResultItem } from './SongResultItem';

const mockVideo = {
  id: 'abc123',
  title: 'Test Song Karaoke',
  channel: 'Karaoke Channel',
  thumbnail: 'https://img.youtube.com/vi/abc123/mqdefault.jpg',
  duration: '3:45',
};

describe('SongResultItem', () => {
  it('renders title and channel', () => {
    const { getByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false} />
    );
    expect(getByText('Test Song Karaoke')).toBeTruthy();
    expect(getByText('Karaoke Channel')).toBeTruthy();
  });

  it('renders duration badge when duration is provided', () => {
    const { getByTestId } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false} />
    );
    expect(getByTestId('duration-badge')).toBeTruthy();
    expect(getByTestId('duration-badge').props.children).toBe('3:45');
  });

  it('does not render duration badge when duration is absent', () => {
    const videoWithoutDuration = { ...mockVideo, duration: undefined } as any;
    const { queryByTestId } = render(
      <SongResultItem video={videoWithoutDuration} onAdd={jest.fn()} added={false} />
    );
    expect(queryByTestId('duration-badge')).toBeNull();
  });

  it('shows add button and calls onAdd in default state', () => {
    const onAdd = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <SongResultItem video={mockVideo} onAdd={onAdd} added={false} />
    );
    expect(getByTestId('add-button')).toBeTruthy();
    fireEvent.press(getByTestId('add-button'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(queryByTestId('action-queued')).toBeNull();
    expect(queryByTestId('action-playing')).toBeNull();
  });

  it('shows check icon instead of add when added=true', () => {
    const { getByTestId, queryByTestId } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={true} />
    );
    expect(getByTestId('action-queued')).toBeTruthy();
    expect(queryByTestId('add-button')).toBeNull();
  });

  it('shows check icon instead of add when queued=true', () => {
    const { getByTestId, queryByTestId } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false} queued={true} />
    );
    expect(getByTestId('action-queued')).toBeTruthy();
    expect(queryByTestId('add-button')).toBeNull();
  });

  it('shows playing action icon when isCurrentlyPlaying=true', () => {
    const { getByTestId, queryByTestId } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false} isCurrentlyPlaying={true} />
    );
    expect(getByTestId('action-playing')).toBeTruthy();
    expect(queryByTestId('add-button')).toBeNull();
    expect(queryByTestId('action-queued')).toBeNull();
  });

  it('shows now-playing status pill when isCurrentlyPlaying=true', () => {
    const { getByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false} isCurrentlyPlaying={true} />
    );
    expect(getByText('Đang phát')).toBeTruthy();
  });

  // The queued and just-added status pills were removed: the action button's
  // green checkmark already indicates queued state, and the bottom snackbar
  // confirms each add — no per-row text affordance is needed.
  it('does not render the queued status pill when queued=true', () => {
    const { queryByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false} queued={true} />
    );
    expect(queryByText(/Hàng chờ/)).toBeNull();
  });

  it('does not render the just-added status pill (snackbar handles it)', () => {
    const { queryByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={true} queued={true} />
    );
    expect(queryByText('Vừa thêm')).toBeNull();
  });

  it('shows no status pill in default state', () => {
    const { queryByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false} />
    );
    expect(queryByText('Đang phát')).toBeNull();
    expect(queryByText('Vừa thêm')).toBeNull();
  });
});
