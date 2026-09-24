import React, { useEffect, useRef, useState } from 'react';
import YoutubeIframe, { PLAYER_STATES, type YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useAdMask } from '@/hooks/useAdMask';

interface BackgroundAudioDriverProps {
  videoId: string;
  isPlaying: boolean;
}

// The hidden (0x0) audio driver that plays the song while the user is on the
// now-playing card (not fullscreen). There is no overlay here — the card already
// hides the video — but ad audio must still be muted.
export function BackgroundAudioDriver({ videoId, isPlaying }: BackgroundAudioDriverProps): React.ReactElement {
  const playerRef = useRef<YoutubeIframeRef>(null);
  const [playerPlaying, setPlayerPlaying] = useState(false);
  // Reset the playing flag on track change so a stale PLAYING from the previous
  // song can't make the ad probe (id-mismatch based) treat a normal song change
  // as an ad and briefly mute the new track.
  useEffect(() => {
    setPlayerPlaying(false);
  }, [videoId]);
  const { isAdGated } = useAdMask(playerRef, videoId, isPlaying && playerPlaying);

  return (
    <YoutubeIframe
      ref={playerRef}
      videoId={videoId}
      height={0}
      width={0}
      play={isPlaying}
      mute={isAdGated}
      onChangeState={(state: string) => setPlayerPlaying(state === PLAYER_STATES.PLAYING)}
    />
  );
}
