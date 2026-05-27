import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { RoomProvider, useRoomContext } from './RoomContext';

const mockRoom = {
  roomData: {
    queue: [],
    currentPlaying: null,
    isPlaying: false,
    isTvActive: false,
    isAutoRandomMode: false,
    dragDropEnabled: true,
    requesterPromptEnabled: true,
    isMCEnabled: true,
    mcVoice: 'neural2A',
    guestCanRemove: false,
    aiScoringEnabled: false,
    volume: 100,
    history: [],
    playedHistory: [],
    randomFilters: { type: 'all', tone: 'all', genre: 'all' },
    lastAnnouncedSongId: null,
    lastScoredSongId: null,
    fullscreenOwner: null,
    lastEndedAt: null,
    hostUid: null,
  },
  isLoading: false,
  roomExists: true,
  addSongToQueue: jest.fn(),
  removeSong: jest.fn(),
  reorderQueue: jest.fn(),
  togglePlayPause: jest.fn(),
  playNext: jest.fn(),
  playPrevious: jest.fn(),
  sendEmoji: jest.fn(),
  setDragDropEnabled: jest.fn(),
  setRequesterPromptEnabled: jest.fn(),
  setMCEnabled: jest.fn(),
  setMcVoice: jest.fn(),
  setAutoRandomMode: jest.fn(),
  setRandomFilters: jest.fn(),
  setGuestCanRemove: jest.fn(),
  setAiScoringEnabled: jest.fn(),
  resetRoom: jest.fn(),
  removeCurrentPlaying: jest.fn(),
  setCurrentPlayingDirectly: jest.fn(),
  playSongNow: jest.fn(),
  updateRequesterName: jest.fn(),
  addToPlayedHistory: jest.fn(),
  tryClaimAnnouncementLock: jest.fn(),
  setIsPlaying: jest.fn(),
};

jest.mock('@bs-kara/shared/hooks', () => ({
  useRoom: () => mockRoom,
  i18n: {},
}));

jest.mock('@/hooks/useCurrentHost', () => ({
  useCurrentHost: () => ({ user: null, profile: null, loading: false }),
}));

function Consumer() {
  const { roomData } = useRoomContext();
  return <Text testID="queue-len">{roomData.queue.length}</Text>;
}

describe('RoomContext', () => {
  it('provides roomData from useRoom', () => {
    const { getByTestId } = render(
      <RoomProvider roomCode="1234"><Consumer /></RoomProvider>
    );
    expect(getByTestId('queue-len').props.children).toBe(0);
  });
});
