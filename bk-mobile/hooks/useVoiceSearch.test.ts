import { renderHook, act } from '@testing-library/react-native';
import { useVoiceSearch } from './useVoiceSearch';

// Mock @react-native-voice/voice
// Note: jest.mock is hoisted, so we use jest.requireMock to get the mock object
// and assign handlers in tests via the shared reference.
jest.mock('@react-native-voice/voice', () => {
  const mockObj = {
    isAvailable: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    destroy: jest.fn(),
    removeAllListeners: jest.fn(),
    onSpeechPartialResults: null,
    onSpeechResults: null,
    onSpeechError: null,
  };
  return { __esModule: true, default: mockObj };
});

// Mock expo-av
const mockPlayAsync = jest.fn();
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: { playAsync: mockPlayAsync, unloadAsync: jest.fn() },
      }),
    },
  },
}));

// Grab a typed reference to the mock after jest.mock is set up
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockVoice = jest.requireMock('@react-native-voice/voice').default as {
  isAvailable: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
  destroy: jest.Mock;
  removeAllListeners: jest.Mock;
  onSpeechPartialResults: ((e: { value?: string[] }) => void) | null;
  onSpeechResults: ((e: { value?: string[] }) => void) | null;
  onSpeechError: ((e: unknown) => void) | null;
};

describe('useVoiceSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVoice.isAvailable.mockResolvedValue(true);
    mockVoice.start.mockResolvedValue(undefined);
    mockVoice.stop.mockResolvedValue(undefined);
    mockVoice.destroy.mockResolvedValue(undefined);
    mockVoice.onSpeechPartialResults = null;
    mockVoice.onSpeechResults = null;
    mockVoice.onSpeechError = null;
  });

  it('calls onUnsupported when Voice.isAvailable() returns false', async () => {
    mockVoice.isAvailable.mockResolvedValue(false);
    const onUnsupported = jest.fn();
    const { result } = renderHook(() =>
      useVoiceSearch({ onFinal: jest.fn(), onUnsupported })
    );
    await act(async () => { await result.current.start(); });
    expect(onUnsupported).toHaveBeenCalledTimes(1);
    expect(mockVoice.start).not.toHaveBeenCalled();
  });

  it('sets isListening=true after start()', async () => {
    const { result } = renderHook(() =>
      useVoiceSearch({ onFinal: jest.fn(), onUnsupported: jest.fn() })
    );
    await act(async () => { await result.current.start(); });
    expect(result.current.isListening).toBe(true);
  });

  it('calls onFinal with first speech result', async () => {
    const onFinal = jest.fn();
    const { result } = renderHook(() =>
      useVoiceSearch({ onFinal, onUnsupported: jest.fn() })
    );
    await act(async () => { await result.current.start(); });
    await act(async () => {
      mockVoice.onSpeechResults?.({ value: ['bolero trữ tình'] });
    });
    expect(onFinal).toHaveBeenCalledWith('bolero trữ tình');
  });

  it('sets interimTranscript from partial results', async () => {
    const { result } = renderHook(() =>
      useVoiceSearch({ onFinal: jest.fn(), onUnsupported: jest.fn() })
    );
    await act(async () => { await result.current.start(); });
    await act(async () => {
      mockVoice.onSpeechPartialResults?.({ value: ['bolero...'] });
    });
    expect(result.current.interimTranscript).toBe('bolero...');
  });

  it('calls Voice.destroy on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useVoiceSearch({ onFinal: jest.fn(), onUnsupported: jest.fn() })
    );
    await act(async () => { await result.current.start(); });
    unmount();
    expect(mockVoice.destroy).toHaveBeenCalled();
    expect(mockVoice.removeAllListeners).toHaveBeenCalled();
  });
});
