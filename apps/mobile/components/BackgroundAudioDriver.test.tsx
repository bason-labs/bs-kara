import { act, render } from '@testing-library/react-native';

// Track the last args passed to useAdMask so tests can assert on isPlaying.
let lastUseAdMaskArgs: unknown[] = [];
const mockUseAdMask = jest.fn();
jest.mock('@/hooks/useAdMask', () => ({
  useAdMask: (...args: unknown[]) => {
    lastUseAdMaskArgs = args;
    return mockUseAdMask();
  },
}));

// Capture the props passed to the iframe so we can assert on `mute`/`play`.
const iframeProps: Record<string, unknown>[] = [];
jest.mock('react-native-youtube-iframe', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      iframeProps.push(props);
      return React.createElement('YoutubeIframe', props);
    },
    PLAYER_STATES: { PLAYING: 'playing' },
  };
});

import { BackgroundAudioDriver } from './BackgroundAudioDriver';

beforeEach(() => {
  iframeProps.length = 0;
  lastUseAdMaskArgs = [];
});

it('mutes the driver when an ad is gated', () => {
  mockUseAdMask.mockReturnValue({ isAdGated: true });
  render(<BackgroundAudioDriver videoId="song1" isPlaying={true} />);
  expect(iframeProps[0].mute).toBe(true);
  expect(iframeProps[0].play).toBe(true); // play is NOT ad-gated
});

it('does not mute when no ad is gated', () => {
  mockUseAdMask.mockReturnValue({ isAdGated: false });
  render(<BackgroundAudioDriver videoId="song1" isPlaying={true} />);
  expect(iframeProps[0].mute).toBe(false);
});

// Regression: BackgroundAudioDriver previously had no reset effect, so
// when videoId changed the internal playerPlaying state remained true from
// the previous track. This caused useAdMask's isPlaying argument to stay
// true across the track transition, which let the id-mismatch probe
// (requestedVideoId vs the new track's URL) briefly treat a normal song
// change as an ad and mute the new track. The fix adds a useEffect that
// calls setPlayerPlaying(false) whenever videoId changes.
//
// How we observe it: the wrapper mock captures every call's args in
// lastUseAdMaskArgs. We drive onChangeState('playing') so playerPlaying
// flips true, then rerender with a new videoId. On the render immediately
// after the videoId change the reset effect fires synchronously (before
// the next useAdMask call in the new render), so useAdMask's third arg
// (isPlaying && playerPlaying) must be false.
//
// Why this test would FAIL against the pre-fix code: without the reset
// effect, playerPlaying remains true through the rerender, so
// lastUseAdMaskArgs[2] would be true (isPlaying=true && playerPlaying=true),
// causing the toBe(false) assertion to fail.
it('resets playerPlaying to false on videoId change so useAdMask sees isPlaying=false', () => {
  mockUseAdMask.mockReturnValue({ isAdGated: false });
  const { rerender } = render(<BackgroundAudioDriver videoId="song1" isPlaying={true} />);

  // Simulate the iframe reporting PLAYING state so playerPlaying flips true.
  // Wrap in act() so React flushes the state update and re-renders before we
  // inspect lastUseAdMaskArgs.
  const onChangeState = iframeProps[0].onChangeState as (s: string) => void;
  act(() => { onChangeState('playing'); });

  // After the flush, useAdMask's third arg (isPlaying && playerPlaying) is
  // true because both flags are true — sanity-check that playerPlaying armed.
  expect(lastUseAdMaskArgs[2]).toBe(true);

  // Now change the videoId. The reset effect fires synchronously in the same
  // commit, setting playerPlaying=false before useAdMask is called.
  rerender(<BackgroundAudioDriver videoId="song2" isPlaying={true} />);

  // useAdMask's third arg must be false: isPlaying=true but playerPlaying
  // was just reset to false by the videoId-change effect.
  // Pre-fix (no reset effect): playerPlaying stays true → arg is true → FAIL.
  expect(lastUseAdMaskArgs[2]).toBe(false);
});
