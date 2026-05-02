'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { YouTubeVideo } from '@/lib/youtube/types';
import { useAutoHide } from '@/hooks/useAutoHide';
import { useMCPlayer } from '@/hooks/useMCPlayer';
import { useMCKickPlay } from '@/hooks/useMCKickPlay';
import { VideoPlayer } from '@/components/VideoPlayer';
import { EmojiLayer } from '@/components/EmojiLayer';
import { MCAnnouncementOverlay } from '@/components/MCAnnouncementOverlay';

interface FullscreenPlayerProps {
  track: YouTubeVideo;
  roomId: string;
  isPlaying: boolean;
  volume: number;
  hasHistory: boolean;
  hasQueue: boolean;
  // When true, the MC speaks before each new song reaches the iframe.
  isMCEnabled: boolean;
  // Google TTS voice id selected in Settings. Forwarded to useMCPlayer.
  mcVoice: string;
  // Cross-device lock from useRoom — passed through so this player can
  // race the TV for the announcement and stay quiet if it loses.
  tryClaimAnnouncementLock?: (songId: string) => Promise<boolean>;
  onSongEnd: () => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPlayingChange?: (playing: boolean) => void;
}

export function FullscreenPlayer({
  track,
  roomId,
  isPlaying,
  volume,
  hasHistory,
  hasQueue,
  isMCEnabled,
  mcVoice,
  tryClaimAnnouncementLock,
  onSongEnd,
  onClose,
  onPrev,
  onNext,
  onPlayingChange,
}: FullscreenPlayerProps) {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { visible: chromeVisible, bump } = useAutoHide(2500);

  // Opening the fullscreen player IS the user gesture, so speech can start
  // immediately on subsequent transitions. The hook also handles the
  // "don't announce the song that was already playing when we opened"
  // case via its initial-skip pattern.
  const { isMcGated, mcText } = useMCPlayer({
    isMCEnabled,
    currentPlaying: track,
    ready: true,
    mcVoice,
    tryClaimAnnouncementLock,
  });

  // Behavior parity with the TV: kick play after MC ungating.
  // onPlayingChange is optional so we wrap into a stable no-op fallback.
  useMCKickPlay(isMcGated, isPlaying, useCallback((next: boolean) => {
    onPlayingChange?.(next);
  }, [onPlayingChange]));

  // The browser Fullscreen API is entered by the caller (the user-gesture
  // handler that flips playerOpen). Here we just make sure to leave it on
  // unmount so closing the overlay also exits native fullscreen.
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Lock to landscape while the fullscreen player is open, mirroring the
  // YouTube app behavior on phones. The Screen Orientation API requires the
  // document to actually be in fullscreen, so we attempt the lock on mount
  // (in case fullscreen was already active) AND on every fullscreenchange.
  // Browsers without the API (desktop Safari, older WebViews) silently
  // skip — both `lock` and `unlock` are guarded.
  useEffect(() => {
    // The Screen Orientation API's `lock()` is in the spec but absent from
    // lib.dom, so we declare the shape locally with the spec's argument union.
    type LockableOrientation = ScreenOrientation & {
      lock?: (
        orientation:
          | 'any'
          | 'natural'
          | 'landscape'
          | 'portrait'
          | 'portrait-primary'
          | 'portrait-secondary'
          | 'landscape-primary'
          | 'landscape-secondary',
      ) => Promise<void>;
    };
    function tryLockLandscape() {
      if (!document.fullscreenElement) return;
      const orientation = window.screen?.orientation as LockableOrientation | undefined;
      try {
        orientation?.lock?.('landscape').catch(() => {});
      } catch {
        // Older browsers throw synchronously instead of rejecting.
      }
    }
    tryLockLandscape();
    document.addEventListener('fullscreenchange', tryLockLandscape);
    return () => {
      document.removeEventListener('fullscreenchange', tryLockLandscape);
      try {
        window.screen?.orientation?.unlock?.();
      } catch {
        // Older browsers throw synchronously when unlock is unsupported.
      }
    };
  }, []);

  // ESC at the document level closes the overlay.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // If the user exits native fullscreen via browser chrome (swipe / Esc), close cleanly.
  useEffect(() => {
    function handleFsChange() {
      if (!document.fullscreenElement) onClose();
    }
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [onClose]);

  // The YouTube iframe lives in its own document, so window-level touchstart
  // listeners (in useAutoHide) never fire when the user taps the video. This
  // overlay sits above the iframe and bumps the chrome back into view.
  function handleTapLayer() {
    bump();
  }

  function handleTogglePlay() {
    onPlayingChange?.(!isPlaying);
    bump();
  }

  function handlePrev() {
    if (!hasHistory) return;
    onPrev();
    bump();
  }

  function handleNext() {
    if (!hasQueue) return;
    onNext();
    bump();
  }

  const showCenterControls = !isMcGated && (!isPlaying || chromeVisible);

  return (
    <div
      ref={wrapperRef}
      className={`fixed inset-0 z-[60] bg-black ${chromeVisible ? '' : 'cursor-none'}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('nowPlaying.label')}
    >
      {/* The iframe stays mounted from open — that load happens inside the
          user gesture from the expand tap, so mobile won't block the
          play() that runs after the MC finishes. While the MC speaks we
          pause + mute the iframe and cover it with the announcement
          overlay. */}
      <div className="absolute inset-0">
        <VideoPlayer
          key={track.id}
          videoId={track.id}
          onSongEnd={onSongEnd}
          isPlaying={!isMcGated && isPlaying}
          volume={isMcGated ? 0 : volume}
          // Suppress the iframe → React sync while MC is speaking.
          // The brief PLAYING/PAUSED state ping when autoplay starts and
          // we immediately pause would otherwise echo back into Firebase
          // and flip isPlaying to false.
          onPlayingChange={isMcGated ? undefined : onPlayingChange}
        />
        {isMcGated && (
          <MCAnnouncementOverlay
            variant="phone"
            title={track.title}
            requesterName={track.requesterName}
            mcText={mcText ?? undefined}
          />
        )}
      </div>

      {/* Tap layer above iframe to capture touches that the iframe would
          otherwise swallow. Sits below the chrome (z-10) and play button. */}
      <button
        type="button"
        onClick={handleTapLayer}
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 z-[5] cursor-default"
      />

      {/* Reactions float above the video and tap layer; pointer-events-none
          inside EmojiLayer keeps the tap layer reachable. */}
      <EmojiLayer roomId={roomId} />

      {/* Top bar: badge + close, single flex row with safe-area padding.
          Hidden while the MC is speaking so the announcement overlay
          stands alone. */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] transition-opacity duration-300 ${
          isMcGated || !chromeVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="min-w-0 flex-1 flex">
          <div className="min-w-0 max-w-full bg-surface/80 backdrop-blur-md border border-border rounded-full px-3 py-1.5 inline-flex items-center gap-2">
            <span className="shrink-0 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-glow font-semibold">
              {t('nowPlaying.label')}
            </span>
            <span className="min-w-0 text-xs sm:text-sm text-fg truncate">
              {track.title}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('player.closeFullscreen')}
          className="shrink-0 w-10 h-10 rounded-full bg-gradient-brand text-white shadow-glow flex items-center justify-center active:scale-95"
        >
          <X size={20} strokeWidth={2.4} />
        </button>
      </div>

      {/* Center transport: prev / play-pause / next.
          Always visible while paused, otherwise tied to chrome. */}
      {showCenterControls && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-6 pointer-events-none">
          <button
            type="button"
            onClick={handlePrev}
            disabled={!hasHistory}
            aria-label={t('controls.previousLabel')}
            className="pointer-events-auto w-12 h-12 rounded-full bg-surface/80 backdrop-blur-md border border-border text-fg flex items-center justify-center active:scale-95 disabled:opacity-40 disabled:active:scale-100"
          >
            <SkipBack size={22} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onClick={handleTogglePlay}
            aria-label={t(isPlaying ? 'player.pause' : 'player.play')}
            className="pointer-events-auto w-16 h-16 rounded-full bg-gradient-brand text-white shadow-glow flex items-center justify-center active:scale-95"
          >
            {isPlaying ? (
              <Pause size={28} strokeWidth={2.4} />
            ) : (
              <Play size={28} strokeWidth={2.4} className="translate-x-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!hasQueue}
            aria-label={t('controls.nextLabel')}
            className="pointer-events-auto w-12 h-12 rounded-full bg-surface/80 backdrop-blur-md border border-border text-fg flex items-center justify-center active:scale-95 disabled:opacity-40 disabled:active:scale-100"
          >
            <SkipForward size={22} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
}
