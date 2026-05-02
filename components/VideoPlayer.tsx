'use client';

import { useRef, useEffect } from 'react';
import YouTube, { YouTubeEvent, YouTubePlayer } from 'react-youtube';

interface VideoPlayerProps {
  videoId: string;
  onSongEnd: () => void;
  isPlaying: boolean;
  volume: number;
  // Called when the YouTube player's playing/paused state changes from inside
  // the iframe (e.g. user clicks the video on the TV to pause). Used to sync
  // that change back into the shared room state.
  onPlayingChange?: (playing: boolean) => void;
}

export function VideoPlayer({ videoId, onSongEnd, isPlaying, volume, onPlayingChange }: VideoPlayerProps) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    const player = playerRef.current;
    if (!player) return;
    try {
      if (isPlaying) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    } catch {
      // YT widget API can throw if the iframe is mid-teardown; ignore.
    }
  }, [isPlaying]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    // The YT widget API throws "Cannot read properties of null (reading 'src')"
    // when these methods are called while the iframe is being torn down or
    // re-attached. Swallow — the next ready event will reapply volume/mute.
    try {
      if (volume === 0) {
        player.mute();
      } else {
        player.unMute();
        player.setVolume(volume);
      }
    } catch {
      // ignore
    }
  }, [volume]);

  // react-youtube already swaps videoId on prop change; manually calling
  // loadVideoById/cueVideoById in addition raced against the wrapper's own
  // iframe src swap and surfaced as `Cannot read properties of null (reading 'src')`
  // in www-widgetapi when the user clicked Next/Prev.

  if (!videoId) return null;

  function handleReady(event: YouTubeEvent) {
    playerRef.current = event.target;
    // Let YouTube pick quality based on network + player size. 'default'
    // is the auto-adaptive mode; without this an upstream caller could
    // accidentally pin a high fixed quality and cause buffering on slow
    // mobile connections.
    try {
      event.target.setPlaybackQuality('default');
    } catch {
      // ignore — method is suggestion-only and may be a no-op
    }
    // Apply current volume immediately so a mounted-muted iframe (e.g. the
    // mobile FullscreenPlayer during the MC announcement) doesn't leak
    // autoplay audio at default volume in the brief window before the
    // volume useEffect runs.
    if (volume === 0) {
      event.target.mute();
    } else {
      event.target.unMute();
      event.target.setVolume(volume);
    }
    // Honor whatever isPlaying is at the moment the player finishes loading,
    // including a pause that arrived before the player was ready (otherwise
    // the iframe's autoplay=1 would keep playing past the pause command).
    if (isPlayingRef.current) {
      event.target.playVideo();
    } else {
      event.target.pauseVideo();
    }
  }

  function handleEnd() {
    onSongEnd();
  }

  function handleStateChange(event: YouTubeEvent) {
    // YT.PlayerState: 1 = PLAYING, 2 = PAUSED. We only care about those —
    // BUFFERING/CUED transitions would cause noisy round-trips.
    const state = event.data;
    if (state !== 1 && state !== 2) return;
    const ytPlaying = state === 1;
    // If the iframe's state already matches what React thinks, the change
    // was driven by our own playVideo/pauseVideo call — nothing to sync.
    if (ytPlaying === isPlayingRef.current) return;
    isPlayingRef.current = ytPlaying;
    onPlayingChange?.(ytPlaying);
  }

  return (
    <YouTube
      videoId={videoId}
      className="w-full h-full"
      iframeClassName="w-full h-full"
      opts={{
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          // Hint YouTube to pick quality adaptively based on network +
          // player size. Paired with setPlaybackQuality('default') in
          // handleReady; either alone is enough but both is harmless.
          vq: 'default',
          // Mount muted when the caller starts at volume 0 (mobile
          // FullscreenPlayer during MC). playerVars are baked at iframe
          // creation, so this prevents the iframe's own autoplay from
          // emitting audio before the JS API mute() call lands.
          mute: volume === 0 ? 1 : 0,
          // Pass the page origin so the YT widgetapi can verify postMessage
          // targets when the iframe is unmounted mid-flight (which we do
          // every time the MC gate flips). Silences the noisy
          // "target origin provided ... does not match" console warning.
          origin:
            typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      }}
      onReady={handleReady}
      onEnd={handleEnd}
      onStateChange={handleStateChange}
    />
  );
}
