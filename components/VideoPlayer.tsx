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
  // Hands the underlying YouTube player object to the parent once it's
  // ready. Used by EndScreenOverlay to poll getCurrentTime / getDuration
  // without re-implementing iframe state inside the overlay.
  onPlayerReady?: (player: YouTubePlayer) => void;
}

export function VideoPlayer({ videoId, onSongEnd, isPlaying, volume, onPlayingChange, onPlayerReady }: VideoPlayerProps) {
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
    onPlayerReady?.(event.target);
  }

  function handleEnd() {
    onSongEnd();
  }

  function handleStateChange(event: YouTubeEvent) {
    // YT.PlayerState: -1 UNSTARTED, 0 ENDED, 1 PLAYING, 2 PAUSED, 3 BUFFERING, 5 CUED.
    // Ignore BUFFERING — it's a transient between play/pause that would
    // cause flicker. Everything else maps to a binary playing flag.
    // Treating CUED/UNSTARTED/ENDED as "not playing" is what lets the
    // iOS tap-to-play overlay state propagate back to Firebase, so the
    // remote's play/pause icon mirrors what the iframe is actually
    // showing instead of stalling on a stale optimistic `true`.
    const state = event.data;
    if (state === 3) return;
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
          // Cap requested quality at 720p. YouTube ABR still adapts down for
          // weak connections; this just prevents the player from REQUESTING
          // 1080p, which is the common cause of buffer-rebuffer stutter on
          // typical home WiFi. Karaoke prioritizes smooth playback over max
          // resolution.
          vq: 'hd720',
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
          // Cleanest possible playback chrome for karaoke: hide native
          // controls, keyboard shortcuts, fullscreen button, captions
          // auto-load, and legacy annotations. End-screen suggestions cannot
          // be fully suppressed via iframe params (YouTube API limitation
          // since 2018) — handled by switching tracks on ENDED via onSongEnd.
          controls: 0,
          rel: 0,
          iv_load_policy: 3,
          fs: 0,
          disablekb: 1,
          playsinline: 1,
          cc_load_policy: 0,
          modestbranding: 1,
        },
      }}
      onReady={handleReady}
      onEnd={handleEnd}
      onStateChange={handleStateChange}
    />
  );
}
