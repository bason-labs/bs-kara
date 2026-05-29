import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PlayerScreen from './player';

// jest.mock factories are hoisted; reference mocks via the `mock` prefix only.
const mockSetIsPlaying = jest.fn();

jest.mock('@/context/RoomContext', () => ({
  useRoomContext: () => ({
    roomCode: '1234',
    roomData: {
      currentPlaying: { id: 'abc', title: 'Song', channel: 'Ch', thumbnail: '', duration: '3:00' },
      isPlaying: false,
      isTvActive: false,
      history: [],
      queue: [],
    },
    togglePlayPause: jest.fn(),
    setIsPlaying: mockSetIsPlaying,
    playNext: jest.fn(),
    playPrevious: jest.fn(),
    sendEmoji: jest.fn(),
  }),
}));

jest.mock('react-native-youtube-iframe', () => 'YoutubeIframe');
jest.mock('@/components/FullscreenPlayer', () => ({ FullscreenPlayer: () => null }));
jest.mock('@/components/TopBar', () => ({ TopBar: () => null }));
jest.mock('@/components/RemoteControls', () => ({ RemoteControls: () => null }));
jest.mock('@/components/EmojiPad', () => ({ EmojiPad: () => null }));

describe('PlayerScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  // Behavior: tapping the expand-to-fullscreen button starts playback so the
  // user doesn't see a paused video after the screen rotates to landscape.
  it('forces isPlaying=true when the expand button is pressed', () => {
    const { getByTestId } = render(<PlayerScreen />);
    fireEvent.press(getByTestId('expand-button'));
    expect(mockSetIsPlaying).toHaveBeenCalledWith(true);
  });
});
