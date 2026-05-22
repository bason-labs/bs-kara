import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SongResultItem } from './SongResultItem';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'search.addedToQueueButton': 'Đã thêm',
        'search.inQueue': 'Trong DS',
        'search.nowPlayingLabel': 'Đang phát',
      };
      return map[key] ?? key;
    },
  }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));

const mockVideo = {
  id: 'abc123',
  title: 'Test Song Karaoke',
  channel: 'Karaoke Channel',
  thumbnail: 'https://img.youtube.com/vi/abc123/mqdefault.jpg',
  duration: '3:45',
};

describe('SongResultItem', () => {
  it('renders the song title', () => {
    const { getByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false} />
    );
    expect(getByText('Test Song Karaoke')).toBeTruthy();
  });

  it('renders duration when provided', () => {
    const { getByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false} />
    );
    expect(getByText('3:45')).toBeTruthy();
  });

  it('calls onAdd when add button pressed in default state', () => {
    const onAdd = jest.fn();
    const { getByTestId } = render(
      <SongResultItem video={mockVideo} onAdd={onAdd} added={false} />
    );
    fireEvent.press(getByTestId('add-button'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows added state (priority 3) when added=true', () => {
    const { getByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={true} />
    );
    expect(getByText('Đã thêm')).toBeTruthy();
  });

  it('shows in-queue state (priority 2) when queued=true', () => {
    const { getByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={true} queued={true} />
    );
    expect(getByText('Trong DS')).toBeTruthy();
  });

  it('shows now-playing state (priority 1) when isCurrentlyPlaying=true', () => {
    const { getByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false}
        queued={true} isCurrentlyPlaying={true} />
    );
    expect(getByText('Đang phát')).toBeTruthy();
  });

  it('renders PlayNow button when onPlayNow is provided in default state', () => {
    const onPlayNow = jest.fn();
    const { getByTestId } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false}
        onPlayNow={onPlayNow} />
    );
    fireEvent.press(getByTestId('play-now-button'));
    expect(onPlayNow).toHaveBeenCalledTimes(1);
  });

  it('does not render PlayNow button when onPlayNow is undefined', () => {
    const { queryByTestId } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false} />
    );
    expect(queryByTestId('play-now-button')).toBeNull();
  });

  it('hides PlayNow when isCurrentlyPlaying=true', () => {
    const { queryByTestId } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false}
        isCurrentlyPlaying={true} onPlayNow={jest.fn()} />
    );
    expect(queryByTestId('play-now-button')).toBeNull();
  });
});
