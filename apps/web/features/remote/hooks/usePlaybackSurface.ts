'use client';

import { useCallback, useEffect, useState } from 'react';
import { primeAudio } from '@/hooks/useAIVoice';
import { useFullscreenOwnership } from '@/features/remote/hooks/useFullscreenOwnership';

interface UsePlaybackSurfaceArgs {
  roomCode: string | null;
  isTvActive: boolean;
  fullscreenOwner: string | null;
  isPlaying: boolean;
  togglePlayPause: (current: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
}

// Who plays the video for this room: the TV, a phone holding the fullscreen
// lock, or nobody. Owns this phone's fullscreen player and the lock around it.
export function usePlaybackSurface({
  roomCode,
  isTvActive,
  fullscreenOwner,
  isPlaying,
  togglePlayPause,
  setIsPlaying,
}: UsePlaybackSurfaceArgs) {
  const [playerOpen, setPlayerOpen] = useState(false);
  const { deviceId, claim, release } = useFullscreenOwnership(roomCode);

  // Cluster-wide view: any device (TV or a phone holding the
  // fullscreenOwner lock) counts as "the cluster has a playback surface".
  // displayedIsPlaying must trust Firebase whenever that's true, so a
  // remote-control phone reflects the host's play/pause state instead of
  // being clamped to "paused".
  const someoneHasSurface = isTvActive || fullscreenOwner !== null;
  const iAmFullscreenOwner = fullscreenOwner === deviceId;
  const displayedIsPlaying = someoneHasSurface ? isPlaying : false;

  // Become the playback surface: enter fullscreen, claim the lock, open the
  // local player.
  //
  // requestFullscreen MUST run synchronously inside the click handler,
  // before the `await claim()`. After an await the user-gesture activation
  // is consumed and the engine either rejects the request outright or
  // briefly enters fullscreen and exits as untrusted — FullscreenPlayer's
  // own fullscreenchange listener then interprets that exit as an explicit
  // close. If the claim later loses the race, exit fullscreen as cleanup.
  const openLocalPlayer = useCallback(() => {
    primeAudio();
    document.documentElement.requestFullscreen?.().catch(() => {});
    void (async () => {
      const ok = await claim();
      if (!ok) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        return;
      }
      setPlayerOpen(true);
      // Assert intent so the iframe will play once the MC gate (if any)
      // releases. Without this, expand-after-MC reads stale isPlaying=false.
      setIsPlaying(true);
    })();
  }, [claim, setIsPlaying]);

  // Tapping play/pause on a phone that already has a host (TV or another
  // phone) is a pure remote-control gesture — write Firebase, do not open
  // local fullscreen. With no host in the cluster, this phone must claim
  // the lock and become the host before opening its own surface.
  const handleTogglePlayPause = useCallback(() => {
    if (someoneHasSurface) {
      togglePlayPause(isPlaying);
      return;
    }
    openLocalPlayer();
  }, [someoneHasSurface, isPlaying, togglePlayPause, openLocalPlayer]);

  // True when another phone currently owns the surface — TV authority is
  // already handled by hiding onExpand when isTvActive.
  // TODO: NowPlayingCard does not yet support a `disabled` / `disabledReason`
  // prop. Once it does, surface this state in the UI with a sublabel like
  // "Đang xem trên thiết bị khác" instead of hiding the button.
  const isExpandBlocked = isTvActive
    ? false
    : fullscreenOwner !== null && !iAmFullscreenOwner;

  // TV came online while we held the phone-side fullscreen lock: drop the
  // claim and close the local surface so the TV takes over cleanly. The TV
  // doesn't write fullscreenOwner; isTvActive alone is enough to make
  // someoneHasSurface true, so other phones already see the cluster as hosted.
  useEffect(() => {
    if (isTvActive && iAmFullscreenOwner) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      void release().then(() => setPlayerOpen(false));
    }
  }, [isTvActive, iAmFullscreenOwner, release]);

  // Close the local player. Exits native fullscreen here (the parent owns
  // this; FullscreenPlayer must NOT do it from a useEffect teardown).
  // Idempotent — fullscreenElement is null if the user just hit ESC /
  // swiped to leave fullscreen, in which case the close-on-fs-exit listener
  // routed us here.
  const closePlayer = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setPlayerOpen(false);
    void release();
  }, [release]);

  return {
    playerOpen,
    displayedIsPlaying,
    isExpandBlocked,
    handleTogglePlayPause,
    handleExpand: openLocalPlayer,
    closePlayer,
  };
}
