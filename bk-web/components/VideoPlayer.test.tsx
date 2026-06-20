import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// react-youtube renders an iframe — replace with a captured component so we
// can assert on the props it receives without booting the YT widgetapi.
let capturedProps: Record<string, unknown> | null = null;
let capturedReady: ((event: { target: PlayerStub }) => void) | null = null;
let capturedStateChange: ((event: { data: number }) => void) | null = null;

class PlayerStub {
  playVideo = vi.fn();
  pauseVideo = vi.fn();
  mute = vi.fn();
  unMute = vi.fn();
  setVolume = vi.fn();
  setPlaybackQuality = vi.fn();
}

vi.mock('react-youtube', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    capturedProps = props;
    capturedReady = props.onReady as typeof capturedReady;
    capturedStateChange = props.onStateChange as typeof capturedStateChange;
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

  it('requests auto-adaptive playback quality on ready so slow networks do not buffer at a pinned high quality', () => {
    render(
      <VideoPlayer videoId="x" onSongEnd={() => {}} isPlaying volume={50} />,
    );
    const player = new PlayerStub();
    capturedReady!({ target: player });
    expect(player.setPlaybackQuality).toHaveBeenCalledWith('default');
  });

  it('caps requested playerVars quality so slow networks do not buffer on 1080p', () => {
    render(
      <VideoPlayer videoId="x" onSongEnd={() => {}} isPlaying volume={50} />,
    );
    const playerVars = (capturedProps?.opts as { playerVars: { vq?: string } }).playerVars;
    // 'large' = 480p cap (≤720p) — see commit 88c6fb2 / c4ad54d.
    expect(playerVars.vq).toBe('large');
  });

  it('forwards onSongEnd as onEnd to the underlying player', () => {
    const onSongEnd = vi.fn();
    render(<VideoPlayer videoId="x" onSongEnd={onSongEnd} isPlaying volume={50} />);
    (capturedProps?.onEnd as () => void)();
    expect(onSongEnd).toHaveBeenCalled();
  });

  // YT.PlayerState mapping. The behavior these tests pin matters because
  // iOS Safari can land in CUED (5) or PAUSED (2) when autoplay is blocked
  // after the MC announcement; if the iframe state never echoes back,
  // Firebase's `isPlaying` stays optimistically true and the RemoteClient's
  // pause icon lies about the player's real state.
  describe('handleStateChange (YT.PlayerState mapping)', () => {
    function readyWith(isPlaying: boolean) {
      const onPlayingChange = vi.fn();
      render(
        <VideoPlayer
          videoId="x"
          onSongEnd={() => {}}
          isPlaying={isPlaying}
          volume={50}
          onPlayingChange={onPlayingChange}
        />,
      );
      const player = new PlayerStub();
      capturedReady!({ target: player });
      // Reset *after* onReady's playVideo/pauseVideo so the assertions
      // below only see what handleStateChange triggered.
      onPlayingChange.mockClear();
      return { onPlayingChange, player };
    }

    it('PLAYING (1) calls onPlayingChange(true)', () => {
      // Iframe must currently think it's paused for the new value to
      // differ — handleStateChange short-circuits when ref already matches.
      const { onPlayingChange } = readyWith(false);
      capturedStateChange!({ data: 1 });
      expect(onPlayingChange).toHaveBeenCalledTimes(1);
      expect(onPlayingChange).toHaveBeenCalledWith(true);
    });

    it('PAUSED (2) calls onPlayingChange(false)', () => {
      const { onPlayingChange } = readyWith(true);
      capturedStateChange!({ data: 2 });
      expect(onPlayingChange).toHaveBeenCalledTimes(1);
      expect(onPlayingChange).toHaveBeenCalledWith(false);
    });

    // The iOS tap-to-play case: blocked autoplay leaves the iframe in
    // CUED. Without this branch the remote button would stay stuck on
    // "playing" until something else echoed PAUSED.
    it('CUED (5) calls onPlayingChange(false)', () => {
      const { onPlayingChange } = readyWith(true);
      capturedStateChange!({ data: 5 });
      expect(onPlayingChange).toHaveBeenCalledTimes(1);
      expect(onPlayingChange).toHaveBeenCalledWith(false);
    });

    it('UNSTARTED (-1) calls onPlayingChange(false)', () => {
      const { onPlayingChange } = readyWith(true);
      capturedStateChange!({ data: -1 });
      expect(onPlayingChange).toHaveBeenCalledTimes(1);
      expect(onPlayingChange).toHaveBeenCalledWith(false);
    });

    it('ENDED (0) calls onPlayingChange(false)', () => {
      const { onPlayingChange } = readyWith(true);
      capturedStateChange!({ data: 0 });
      expect(onPlayingChange).toHaveBeenCalledTimes(1);
      expect(onPlayingChange).toHaveBeenCalledWith(false);
    });

    it('BUFFERING (3) is ignored (no onPlayingChange call) to avoid flicker', () => {
      const { onPlayingChange } = readyWith(true);
      capturedStateChange!({ data: 3 });
      expect(onPlayingChange).not.toHaveBeenCalled();
    });

    it('does not echo back when the iframe state already matches React state', () => {
      // onReady called playVideo() so isPlayingRef === true; a PLAYING ping
      // would otherwise round-trip uselessly.
      const { onPlayingChange } = readyWith(true);
      capturedStateChange!({ data: 1 });
      expect(onPlayingChange).not.toHaveBeenCalled();
    });
  });
});
