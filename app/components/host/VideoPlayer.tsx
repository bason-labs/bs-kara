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
    if (isPlaying) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }, [isPlaying]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.setVolume(volume);
  }, [volume]);

  // react-youtube already swaps videoId on prop change; manually calling
  // loadVideoById/cueVideoById in addition raced against the wrapper's own
  // iframe src swap and surfaced as `Cannot read properties of null (reading 'src')`
  // in www-widgetapi when the user clicked Next/Prev.

  if (!videoId) return null;

  function handleReady(event: YouTubeEvent) {
    playerRef.current = event.target;
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
        },
      }}
      onReady={handleReady}
      onEnd={handleEnd}
      onStateChange={handleStateChange}
    />
  );
}
