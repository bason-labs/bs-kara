// jest.mock factories are hoisted; reference mocks via the `mock` prefix only.
const mockRemoveSong = jest.fn();
const mockReorderQueue = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-draggable-flatlist', () => {
  const { View } = require('react-native');
  const DraggableFlatList = ({ data, renderItem }: { data: unknown[]; renderItem: (info: unknown) => React.ReactNode }) => (
    <View>
      {data.map((item, index) => (
        <View key={String(index)}>{renderItem({ item, drag: () => {}, getIndex: () => index })}</View>
      ))}
    </View>
  );
  return { __esModule: true, default: DraggableFlatList };
});

jest.mock('@/context/RoomContext', () => ({
  useRoomContext: () => ({
    roomCode: 'TEST',
    roomData: {
      queue: [
        { queueId: 'q1', id: 'v1', title: 'First', channel: 'Ch1', thumbnail: '', duration: '3:00' },
      ],
      dragDropEnabled: false,
      guestCanRemove: true,
    },
    removeSong: mockRemoveSong,
    reorderQueue: mockReorderQueue,
    isHost: false,
  }),
}));

jest.mock('@/components/TopBar', () => ({ TopBar: () => null }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import QueueScreen from './queue';

describe('QueueScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  // Behavior: tapping the trash icon must NOT delete immediately —
  // it opens a confirm dialog so a misclick doesn't silently lose a queued song.
  it('opens the confirm dialog instead of removing immediately', () => {
    const { getByTestId, getByText, queryByText } = render(<QueueScreen />);
    expect(queryByText('queue.removeConfirm.title')).toBeNull();

    fireEvent.press(getByTestId('remove-button'));

    expect(getByText('queue.removeConfirm.title')).toBeTruthy();
    expect(mockRemoveSong).not.toHaveBeenCalled();
  });

  it('calls removeSong with the queueId when the confirm button is pressed', () => {
    const { getByTestId, getByText } = render(<QueueScreen />);
    fireEvent.press(getByTestId('remove-button'));
    fireEvent.press(getByText('queue.removeConfirm.confirm'));
    expect(mockRemoveSong).toHaveBeenCalledWith('q1');
  });

  it('does not call removeSong when the cancel button is pressed', () => {
    const { getByTestId, getByText } = render(<QueueScreen />);
    fireEvent.press(getByTestId('remove-button'));
    fireEvent.press(getByText('queue.removeConfirm.cancel'));
    expect(mockRemoveSong).not.toHaveBeenCalled();
  });
});
