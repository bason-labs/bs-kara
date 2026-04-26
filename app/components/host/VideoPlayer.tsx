'use client';

import { useRef, useEffect } from 'react';
import YouTube, { YouTubeEvent, YouTubePlayer } from 'react-youtube';

interface VideoPlayerProps {
  videoId: string;
  onSongEnd: () => void;
  isPlaying: boolean;
}

export function VideoPlayer({ videoId, onSongEnd, isPlaying }: VideoPlayerProps) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  // Track isPlaying in a ref so the videoId effect can read it without being a dependency
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
    const player = playerRef.current as any; // loadVideoById/cueVideoById not in YouTubePlayer type
    if (!player) return;
    if (isPlayingRef.current) {
      player.loadVideoById(videoId);
    } else {
      player.cueVideoById(videoId);
    }
  }, [videoId]);

  function handleReady(event: YouTubeEvent) {
    playerRef.current = event.target;
    if (isPlayingRef.current) {
      event.target.playVideo();
    }
  }

  function handleEnd() {
    console.log('Song ended, ready for next!');
    onSongEnd();
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
    />
  );
}
