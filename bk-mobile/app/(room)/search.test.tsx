// mocks must be declared before imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'requester.title': 'Ai sẽ hát bài này?',
        'requester.placeholder': 'Tên ca sĩ',
        'requester.skipButton': 'Bỏ qua',
        'requester.confirmButton': 'Xác nhận',
      };
      return map[key] ?? key;
    },
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/context/RoomContext', () => ({
  useRoomContext: () => ({
    roomCode: 'TEST',
    roomData: {
      queue: [],
      currentPlaying: null,
      isPlaying: false,
      isTvActive: false,
      requesterPromptEnabled: true,
      dragDropEnabled: false,
    },
    addSongToQueue: jest.fn().mockResolvedValue(undefined),
    removeSong: jest.fn(),
  }),
}));

jest.mock('@/context/SettingsContext', () => ({
  useSettingsContext: () => ({ openSettings: jest.fn() }),
}));

jest.mock('@/hooks/useSearchHistory', () => ({
  useSearchHistory: () => ({ history: [], push: jest.fn(), remove: jest.fn() }),
}));

jest.mock('@/hooks/useSearchSuggestions', () => ({
  useSearchSuggestions: () => ({ suggestions: [], clear: jest.fn() }),
}));

jest.mock('@/hooks/useQueuedMap', () => ({
  useQueuedMap: () => new Map(),
}));

jest.mock('@/hooks/useVoiceSearch', () => ({
  useVoiceSearch: () => ({ isListening: false, interimTranscript: '', start: jest.fn(), stop: jest.fn() }),
}));

jest.mock('@/components/TopBar', () => ({
  TopBar: () => null,
}));

jest.mock('@/components/AddedToast', () => ({
  AddedToast: () => null,
}));

jest.mock('@/components/SearchSkeleton', () => ({
  SearchSkeleton: () => null,
}));

jest.mock('@/components/VoiceSearchModal', () => ({
  VoiceSearchModal: () => null,
}));

jest.mock('@/components/FiltersSheet', () => ({
  FiltersSheet: () => null,
  ALL_FILTER_OPTIONS: [],
  buildKeywordsFromFilters: () => '',
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SearchScreen from './search';

const mockVideo = {
  id: 'vid1',
  title: 'Test Song Karaoke',
  channel: 'Karaoke Channel',
  thumbnail: 'https://img.youtube.com/vi/vid1/mqdefault.jpg',
  duration: '3:45',
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [mockVideo],
  }) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SearchScreen — requester modal', () => {
  it('dismisses the modal without adding the song when backdrop is pressed', async () => {
    const { getByTestId, getByText, queryByText } = render(<SearchScreen />);

    await waitFor(() => expect(getByTestId('add-button')).toBeTruthy());
    fireEvent.press(getByTestId('add-button'));
    expect(getByText('Ai sẽ hát bài này?')).toBeTruthy();

    fireEvent.press(getByTestId('requester-backdrop'));

    expect(queryByText('Ai sẽ hát bài này?')).toBeNull();
  });

  it('clears the pending video so re-opening works cleanly', async () => {
    const { getByTestId, getByText, queryByText } = render(<SearchScreen />);

    await waitFor(() => expect(getByTestId('add-button')).toBeTruthy());
    fireEvent.press(getByTestId('add-button'));
    fireEvent.press(getByTestId('requester-backdrop'));
    expect(queryByText('Ai sẽ hát bài này?')).toBeNull();

    // open again — should work cleanly
    fireEvent.press(getByTestId('add-button'));
    expect(getByText('Ai sẽ hát bài này?')).toBeTruthy();
  });
});
