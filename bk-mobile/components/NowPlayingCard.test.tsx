import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'nowPlaying.label': 'Đang phát',
        'nowPlaying.removeAriaLabel': 'Bỏ qua bài đang phát',
      };
      return map[key] ?? key;
    },
  }),
}));

import { NowPlayingCard } from './NowPlayingCard';

const mockSong = {
  id: 'abc',
  title: 'Test Song Karaoke',
  channel: 'Channel',
  thumbnail: 'https://img.youtube.com/vi/abc/mqdefault.jpg',
  duration: '3:00',
  requesterName: 'Bason',
};

const song = { id: 'v1', title: 'Test Song', channel: 'Ch', thumbnail: 'https://img', duration: '3:00' };

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

  it('returns null when song is null (hero variant)', () => {
    const { toJSON } = render(<NowPlayingCard song={null} isPlaying={false} onToggle={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('renders hero variant with ĐANG PHÁT label', () => {
    const { getByText } = render(
      <NowPlayingCard song={song} isPlaying={false} onToggle={jest.fn()} variant="hero" />
    );
    expect(getByText('Đang phát')).toBeTruthy();
  });

  it('renders expand button when onExpand provided and isTvActive is false', () => {
    const { getByTestId } = render(
      <NowPlayingCard song={song} isPlaying={false} onToggle={jest.fn()} variant="hero" onExpand={jest.fn()} isTvActive={false} />
    );
    expect(getByTestId('expand-button')).toBeTruthy();
  });

  it('hides expand button when isTvActive is true', () => {
    const { queryByTestId } = render(
      <NowPlayingCard song={song} isPlaying={false} onToggle={jest.fn()} variant="hero" onExpand={jest.fn()} isTvActive={true} />
    );
    expect(queryByTestId('expand-button')).toBeNull();
  });
});
