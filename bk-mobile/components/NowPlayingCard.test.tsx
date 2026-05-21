import React from 'react';
import { render } from '@testing-library/react-native';
import { NowPlayingCard } from './NowPlayingCard';

const mockSong = {
  id: 'abc',
  title: 'Test Song Karaoke',
  channel: 'Channel',
  thumbnail: 'https://img.youtube.com/vi/abc/mqdefault.jpg',
  duration: '3:00',
  requesterName: 'Bason',
};

describe('NowPlayingCard', () => {
  it('renders song title', () => {
    const { getByText } = render(
      <NowPlayingCard song={mockSong} isPlaying={true} onToggle={jest.fn()} />
    );
    expect(getByText('Test Song Karaoke')).toBeTruthy();
  });

  it('shows requester name when present', () => {
    const { getByText } = render(
      <NowPlayingCard song={mockSong} isPlaying={true} onToggle={jest.fn()} />
    );
    expect(getByText('Bason')).toBeTruthy();
  });

  it('renders nothing when song is null', () => {
    const { queryByTestId } = render(
      <NowPlayingCard song={null} isPlaying={false} onToggle={jest.fn()} />
    );
    expect(queryByTestId('now-playing-card')).toBeNull();
  });
});
