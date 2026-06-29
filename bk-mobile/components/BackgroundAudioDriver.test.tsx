import { render } from '@testing-library/react-native';

const mockUseAdMask = jest.fn();
jest.mock('@/hooks/useAdMask', () => ({ useAdMask: () => mockUseAdMask() }));

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

beforeEach(() => { iframeProps.length = 0; });

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
