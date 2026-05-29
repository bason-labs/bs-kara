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

// jest.mock factories may only reference variables with the `mock` prefix.
let mockVoiceIsSupported = true;
let mockCapturedOnUnsupported: (() => void) | null = null;
jest.mock('@/hooks/useVoiceSearch', () => ({
  useVoiceSearch: ({ onUnsupported }: { onUnsupported: () => void }) => {
    mockCapturedOnUnsupported = onUnsupported;
    return {
      isListening: false,
      interimTranscript: '',
      start: jest.fn(),
      stop: jest.fn(),
      isSupported: mockVoiceIsSupported,
    };
  },
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
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
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

describe('SearchScreen — voice button', () => {
  beforeEach(() => {
    mockVoiceIsSupported = true;
    mockCapturedOnUnsupported = null;
  });

  it('renders the voice button when voice is supported', async () => {
    const { getByTestId } = render(<SearchScreen />);
    await waitFor(() => expect(getByTestId('voice-button')).toBeTruthy());
  });

  // Regression: on devices without the native Voice module (e.g. Android with
  // @react-native-voice/voice's name mismatch, or Expo Go), the mic button
  // must not render — it used to be tappable and would surface the network
  // error UI ("Lỗi kết nối"), confusing the user.
  it('hides the voice button when voice is unsupported', async () => {
    mockVoiceIsSupported = false;
    const { queryByTestId } = render(<SearchScreen />);
    await waitFor(() => expect(queryByTestId('add-button')).toBeTruthy());
    expect(queryByTestId('voice-button')).toBeNull();
  });

  // Regression: onUnsupported used to call setSearchError('generic'), which
  // showed the WifiOff "Lỗi kết nối" card even though no network call failed.
  // The voice-unsupported state must not poison the search-results error UI.
  it('does not show the search-error UI when onUnsupported fires', async () => {
    const { queryByText } = render(<SearchScreen />);
    await waitFor(() => expect(mockCapturedOnUnsupported).not.toBeNull());
    act(() => {
      mockCapturedOnUnsupported?.();
    });
    // The mock i18n falls back to keys, so the error subtitle would appear as
    // its key if the error UI rendered.
    expect(queryByText('search.errorGenericSubtitle')).toBeNull();
  });
});
