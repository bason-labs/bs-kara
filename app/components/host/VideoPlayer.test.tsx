import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// react-youtube renders an iframe — replace with a captured component so we
// can assert on the props it receives without booting the YT widgetapi.
let capturedProps: Record<string, unknown> | null = null;
let capturedReady: ((event: { target: PlayerStub }) => void) | null = null;

class PlayerStub {
  playVideo = vi.fn();
  pauseVideo = vi.fn();
  mute = vi.fn();
  unMute = vi.fn();
  setVolume = vi.fn();
}

vi.mock('react-youtube', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    capturedProps = props;
    capturedReady = props.onReady as typeof capturedReady;
    return null;
  },
}));

import { VideoPlayer } from './VideoPlayer';

describe('VideoPlayer', () => {
  it('renders nothing when videoId is empty', () => {
    capturedProps = null;
    const { container } = render(
      <VideoPlayer videoId="" onSongEnd={() => {}} isPlaying volume={50} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(capturedProps).toBeNull();
  });

  it('passes videoId and player options to react-youtube', () => {
    render(
      <VideoPlayer videoId="abc123" onSongEnd={() => {}} isPlaying volume={75} />,
    );
    expect(capturedProps?.videoId).toBe('abc123');
    expect((capturedProps?.opts as { playerVars: { autoplay: number } }).playerVars.autoplay).toBe(1);
  });

  it('on ready, applies volume and starts playing when isPlaying is true', () => {
    render(
      <VideoPlayer videoId="x" onSongEnd={() => {}} isPlaying volume={50} />,
    );
    const player = new PlayerStub();
    capturedReady!({ target: player });
    expect(player.unMute).toHaveBeenCalled();
    expect(player.setVolume).toHaveBeenCalledWith(50);
    expect(player.playVideo).toHaveBeenCalled();
  });

  it('on ready with volume=0, mutes the player and respects isPlaying=false', () => {
    render(
      <VideoPlayer videoId="x" onSongEnd={() => {}} isPlaying={false} volume={0} />,
    );
    const player = new PlayerStub();
    capturedReady!({ target: player });
    expect(player.mute).toHaveBeenCalled();
    expect(player.pauseVideo).toHaveBeenCalled();
  });

  it('forwards onSongEnd as onEnd to the underlying player', () => {
    const onSongEnd = vi.fn();
    render(<VideoPlayer videoId="x" onSongEnd={onSongEnd} isPlaying volume={50} />);
    (capturedProps?.onEnd as () => void)();
    expect(onSongEnd).toHaveBeenCalled();
  });
});
