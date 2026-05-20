'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import type { YouTubePlayer } from 'react-youtube';
import { YouTubeVideo } from '@/lib/youtube/types';
import { useAutoHide } from '@/hooks/useAutoHide';
import { useMCPlayer } from '@/hooks/useMCPlayer';
import { useSongScore } from '@/hooks/useSongScore';
import { VideoPlayer } from '@/components/VideoPlayer';
import { EmojiLayer } from '@/components/EmojiLayer';
import { MCAnnouncementOverlay } from '@/components/MCAnnouncementOverlay';
import { EndScreenOverlay } from '@/components/EndScreenOverlay';
import { IdleQRCode } from '@/components/IdleQRCode';

interface FullscreenPlayerProps {
  // Nullable: the player stays mounted even when no song is loaded so the
  // user keeps their fullscreen state across song-end / queue-empty
  // transitions. When a new song lands in currentPlaying the same surface
  // resumes playback without unmount/remount.
  track: YouTubeVideo | null;
  roomId: string;
  isPlaying: boolean;
  volume: number;
  hasHistory: boolean;
  hasQueue: boolean;
  // When true, the MC speaks before each new song reaches the iframe.
  isMCEnabled: boolean;
  // Google TTS voice id selected in Settings. Forwarded to useMCPlayer.
  mcVoice: string;
  // Per-room AI scoring toggle. Forwarded to useSongScore so the outro
  // ScoreBlock only renders when the host opted in.
  aiScoringEnabled: boolean;
  // Cross-device lock from useRoom — passed through so this player can
  // race the TV for the announcement and stay quiet if it loses.
  tryClaimAnnouncementLock?: (songId: string) => Promise<boolean>;
  onSongEnd: () => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPlayingChange?: (playing: boolean) => void;
  // Title shown by the end-of-song celebratory overlay during the last
  // ~5s of playback. RemoteClient passes queue[0]?.title.
  nextSongTitle?: string | null;
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
  aiScoringEnabled,
  tryClaimAnnouncementLock,
  onSongEnd,
  onClose,
  onPrev,
  onNext,
  onPlayingChange,
  nextSongTitle,
}: FullscreenPlayerProps) {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [ytPlayer, setYtPlayer] = useState<YouTubePlayer | null>(null);
  const { visible: chromeVisible, bump } = useAutoHide(2500);
  const [outroActive, setOutroActive] = useState(false);
  const handleOutroVisibleChange = useCallback((v: boolean) => setOutroActive(v), []);

  // Opening the fullscreen player IS the user gesture, so speech can start
  // immediately on subsequent transitions. The hook also handles the
  // "don't announce the song that was already playing when we opened"
  // case via its initial-skip pattern.
  //
  // Resume after MC: `isPlaying` (room intent) stays true throughout the
  // gate (no path writes false during gating — see the suppressed
  // `onPlayingChange` on VideoPlayer below). When the gate releases, the
  // VideoPlayer's `isPlaying` prop flips false→true and its prop effect
  // calls `player.playVideo()`. No optimistic Firebase write here.
  const { isMcGated, mcText } = useMCPlayer({
    isMCEnabled,
    currentPlaying: track,
    ready: true,
    mcVoice,
    tryClaimAnnouncementLock,
  });

  // Live outro score. Returns null when the toggle is off or no song is
  // loaded — pass-through into EndScreenOverlay's optional `score` prop.
  const songScore = useSongScore(roomId, track?.id ?? null, aiScoringEnabled);

  // The browser Fullscreen API is entered by the *caller* (the user-gesture
  // handler that flips playerOpen) and exited by the *caller* on every real
  // close path (RemoteClient's onClose handler + the TV-active effect).
  //
  // We deliberately do NOT exit fullscreen from a useEffect cleanup here:
  // in dev (Next.js defaults reactStrictMode=true), Strict Mode runs every
  // effect's cleanup in a synthetic mount → cleanup → mount bounce right
  // after first mount. With fullscreen already active, that cleanup would
  // exit fullscreen, the close-on-fs-exit listener below would fire onClose
  // on the next mount, and the user would see the overlay flash open and
  // close instantly. Letting the parent own the exit avoids the bounce.

  // Android path: lock to landscape while the fullscreen player is open via
  // the Screen Orientation API. iOS Safari does not implement
  // screen.orientation.lock(), so we handle iOS in a separate effect below
  // (CSS rotation fallback) and leave this effect's call as a no-op there.
  // The Screen Orientation API requires the document to actually be in
  // fullscreen, so we attempt the lock on mount (in case fullscreen was
  // already active) AND on every fullscreenchange. Browsers without the
  // API (desktop Safari, older WebViews) silently skip — both `lock` and
  // `unlock` are guarded.
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

  // iOS Safari path: no Screen Orientation API → CSS-rotation fallback.
  //
  // Why this is React state, not classList.add:
  //   The wrapper's className is recomputed every render
  //   (`${chromeVisible ? '' : 'cursor-none'}`). When useAutoHide flips
  //   chromeVisible, React replaces the entire className attribute,
  //   wiping out any class added imperatively. That produced the
  //   "wide container without rotation" bug: inline width/height stayed
  //   (React doesn't manage them) but the rotation class was gone.
  //   Owning the class in React state means it survives re-renders.
  //
  // Why CSS dvh/dvw, not inline pixels:
  //   iOS Safari's URL bar collapses ~1s after fullscreen entry, growing
  //   window.innerHeight. Inline `width: ${innerHeight}px` would lock to
  //   the pre-collapse height. `100dvh` (dynamic viewport units) tracks
  //   the live viewport without JS, so the rotated box stays right-sized.
  //
  // Why a flag for orientationchange (kept from previous fix):
  //   matchMedia('(orientation: ...)') reflects the viewport, not the
  //   device. iOS fires orientationchange / resize for URL-bar / keyboard /
  //   fullscreen transitions. We read physical angle from
  //   screen.orientation.angle (iOS 16.4+) / window.orientation (legacy)
  //   and only react to a real delta — spurious events are no-ops.
  const [isIosForcedLandscape, setIsIosForcedLandscape] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    if (!isIOS) return;

    function getPhysicalOrientation(): 'portrait' | 'landscape' {
      const stdAngle = window.screen?.orientation?.angle;
      const legacyAngle = (window as { orientation?: number }).orientation;
      const angle =
        typeof stdAngle === 'number'
          ? stdAngle
          : typeof legacyAngle === 'number'
            ? legacyAngle
            : 0;
      return Math.abs(angle) === 90 ? 'landscape' : 'portrait';
    }

    // ── DIAGNOSTIC LOGGING (REMOVE AFTER iOS BUG IS CONFIRMED FIXED) ──
    // The build marker lets us verify on a real device that the new
    // bundle is actually loaded (cached service workers / Vercel CDN
    // can serve stale builds). Look for `[FS/iOS] build:dvh-state v1`
    // in the Safari Web Inspector console.
    const BUILD_TAG = '[FS/iOS] build:dvh-state v1';
    function logViewport(label: string) {
      const w = window as Window & { orientation?: number };
      console.log(BUILD_TAG, label, {
        angle: window.screen?.orientation?.angle ?? null,
        legacyOrientation: typeof w.orientation === 'number' ? w.orientation : null,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        vvWidth: window.visualViewport?.width ?? null,
        vvHeight: window.visualViewport?.height ?? null,
        fullscreenElement: document.fullscreenElement?.tagName ?? null,
      });
    }
    logViewport('mount');
    // ────────────────────────────────────────────────────────────────

    // Initial sync: iOS detection requires window/navigator, so it can't
    // happen in useState's lazy initializer during SSR. Synchronous
    // setState here triggers one extra render on iOS only — acceptable
    // for parity with the orientationchange code path below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIosForcedLandscape(getPhysicalOrientation() === 'portrait');

    function handleOrientationChange() {
      logViewport('orientationchange');
      // Idempotent: setState with the same value is a no-op in React.
      // This makes spurious orientationchange events (URL-bar collapse
      // and friends) cost-free instead of toggling the rotation off.
      setIsIosForcedLandscape(getPhysicalOrientation() === 'portrait');
    }
    function handleVisualViewportResize() {
      // Pure observation — CSS dvh/dvw handles the dimension change.
      // Do NOT touch isIosForcedLandscape here; viewport size changes
      // are not orientation changes.
      logViewport('visualViewport.resize');
    }
    function handleFullscreenChange() {
      logViewport('fullscreenchange');
    }

    window.addEventListener('orientationchange', handleOrientationChange);
    window.visualViewport?.addEventListener('resize', handleVisualViewportResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.visualViewport?.removeEventListener('resize', handleVisualViewportResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
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

  // Hide entirely while the celebratory outro is up so the headline isn't
  // competing with playback chrome — the outro layer above blocks taps to
  // the iframe, so the user can't accidentally pause through it either.
  const showCenterControls =
    !!track && !isMcGated && !outroActive && (!isPlaying || chromeVisible);

  return (
    <div
      ref={wrapperRef}
      className={`fixed inset-0 z-[60] bg-black ${chromeVisible ? '' : 'cursor-none'} ${isIosForcedLandscape ? 'ios-fullscreen-landscape' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('nowPlaying.label')}
    >
      {/* The iframe stays mounted from open — that load happens inside the
          user gesture from the expand tap, so mobile won't block the
          play() that runs after the MC finishes. While the MC speaks we
          pause + mute the iframe and cover it with the announcement
          overlay.

          When `track` is null the player is idle (song just ended, queue
          empty) — render a neutral placeholder instead of an iframe.
          Mounting an iframe with no videoId would either error or load
          a YouTube error screen. */}
      <div className="absolute inset-0">
        {track ? (
          <>
            <VideoPlayer
              key={track.id}
              videoId={track.id}
              onSongEnd={onSongEnd}
              isPlaying={!isMcGated && isPlaying}
              volume={isMcGated ? 0 : volume}
              onPlayingChange={isMcGated ? undefined : onPlayingChange}
              onPlayerReady={setYtPlayer}
            />
            {isMcGated && (
              <MCAnnouncementOverlay
                variant="phone"
                title={track.title}
                requesterName={track.requesterName}
                mcText={mcText ?? undefined}
                onClose={onClose}
              />
            )}
            {/* End-screen overlay sits above the iframe + tap layer (z-[5])
                but below the chrome and center transport (z-10). The wrapper
                creates a stacking context at z-[6] so the overlay's internal
                z-20 doesn't escape past the chrome. */}
            {!isMcGated && (
              <div className="absolute inset-0 z-[6] pointer-events-none">
                <EndScreenOverlay
                  player={ytPlayer}
                  songId={track.id}
                  nextSongTitle={nextSongTitle ?? null}
                  onVisibleChange={handleOutroVisibleChange}
                  score={songScore}
                />
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center overflow-y-auto py-8">
            <IdleQRCode roomCode={roomId} size={200} />
          </div>
        )}
      </div>

      {/* No tap-bump layer here. TVClient (the reference implementation)
          renders the iframe under transport / close chrome with no overlay
          and works correctly. An aria-hidden button used to sit on top to
          bump the auto-hide chrome on touch (because the iframe is a
          separate document and its events don't bubble to window-level
          useAutoHide listeners), but it also blocked YouTube's native
          controls — the timeline scrubber, play/pause, fullscreen, etc.,
          which VideoPlayer enables in dev. Trade-off: chrome may stay
          hidden once the user starts interacting with the iframe; pause
          or any visible button (top-bar X, transport prev/next/play) will
          re-bump it. */}

      {/* Reactions float above the video; pointer-events-none
          inside EmojiLayer keeps the tap layer reachable. */}
      <EmojiLayer roomId={roomId} />

      {/* Top bar: badge + close, single flex row with safe-area padding.
          Hidden while the MC is speaking so the announcement overlay
          stands alone. */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] transition-opacity duration-300 ${
          isMcGated || (track && !chromeVisible)
            ? 'opacity-0 pointer-events-none'
            : 'opacity-100'
        }`}
      >
        <div className="min-w-0 flex-1 flex">
          {track && (
            <div className="min-w-0 max-w-full bg-surface/80 backdrop-blur-md border border-border rounded-full px-3 py-1.5 inline-flex items-center gap-2">
              <span className="shrink-0 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-glow font-semibold">
                {t('nowPlaying.label')}
              </span>
              <span className="min-w-0 text-xs sm:text-sm text-fg truncate">
                {track.title}
              </span>
            </div>
          )}
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

      {/* Center transport: prev / play-pause / next. Snap-mounted via
          showCenterControls (paused → always visible, playing → tied to
          chrome). Hidden during MC gate and during the end-of-song outro. */}
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
