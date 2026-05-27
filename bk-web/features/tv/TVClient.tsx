'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, Mic, Minimize2 } from 'lucide-react';
import type { YouTubePlayer } from 'react-youtube';
import { useRoom } from '@bs-kara/shared/hooks';
import { useAutoHide } from '@/hooks/useAutoHide';
import { useAutoRandom } from '@/hooks/useAutoRandom';
import { useMCPlayer } from '@/hooks/useMCPlayer';
import { useSongScore } from '@/hooks/useSongScore';
import { VideoPlayer } from '@/components/VideoPlayer';
import { EmojiLayer } from '@/components/EmojiLayer';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MCAnnouncementOverlay } from '@/components/MCAnnouncementOverlay';
import { EndScreenOverlay } from '@/components/EndScreenOverlay';
import { IdleQRCode } from '@/components/IdleQRCode';
import { TransportControls } from '@/components/TransportControls';
import { useTVPresence } from '@/features/tv/hooks/useTVPresence';
import { useEndParty } from '@/features/tv/hooks/useEndParty';
import { BackdropLayers } from '@/features/tv/components/BackdropLayers';
import { TVRoomLookup } from '@/features/tv/components/TVRoomLookup';
import { WaitingOverlay } from '@/features/tv/components/WaitingOverlay';
import { QueuePanel } from '@/features/tv/components/QueuePanel';

export default function TVClient() {
  const { t } = useTranslation();
  const [isInitialized, setIsInitialized] = useState(false);
  const initialize = useCallback(() => setIsInitialized(true), []);

  const { phase, roomCode, joinUrl, activateRoomByCode, resolveRoomCode } = useTVPresence();

  const {
    roomData,
    isLoading,
    playNext,
    playPrevious,
    togglePlayPause,
    resetRoom,
    setIsPlaying,
    addToPlayedHistory,
    setCurrentPlayingDirectly,
    tryClaimAnnouncementLock,
  } = useRoom(roomCode);

  useAutoRandom({
    enabled: roomData.isAutoRandomMode,
    ready: isInitialized,
    hasCurrentPlaying: !!roomData.currentPlaying,
    queueLength: roomData.queue.length,
    randomFilters: roomData.randomFilters,
    playedHistory: roomData.playedHistory,
    setCurrentPlayingDirectly,
    addToPlayedHistory,
  });

  const handleSongEnd = useCallback(() => {
    // playNext promotes queue[0] → currentPlaying when the queue has items,
    // or pushes the just-ended song to history and clears currentPlaying
    // when it's empty. The cleared slot then trips useAutoRandom (if on),
    // which fetches the next random song. Single entry point keeps the
    // state machine readable.
    playNext();
  }, [playNext]);

  const {
    endConfirmOpen,
    openEndConfirm,
    closeEndConfirm,
    confirmEndParty,
    endNotice,
  } = useEndParty(resetRoom);


  // Auto-promote the first queued song when nothing is playing
  useEffect(() => {
    if (!isInitialized) return;
    if (!roomData.currentPlaying && roomData.queue.length > 0) {
      playNext();
    }
  }, [isInitialized, roomData.currentPlaying, roomData.queue.length, playNext]);

  // ── AI MC announcement ─────────────────────────────────────────────────
  // Speech is gated behind isInitialized so the first announcement runs
  // inside a fresh user gesture (browsers block speechSynthesis until
  // then). The hook itself decides when to fetch / speak. The lock
  // ensures only one device speaks when both TV and a phone player are
  // open at the same time.
  // `roomData.isPlaying` represents user intent and stays true throughout
  // the MC gate (no path writes false during gating: VideoPlayer's
  // iframe→Firebase echo is suppressed via `onPlayingChange={isMcGated ?
  // undefined : setIsPlaying}` below). When the gate releases, the
  // `isPlaying` prop on VideoPlayer flips false→true, which kicks
  // `player.playVideo()` from the prop-driven effect inside VideoPlayer.
  // No optimistic Firebase write is needed here — and adding one would
  // race the iframe on iOS where autoplay can fail.
  const { isMcGated, mcText } = useMCPlayer({
    isMCEnabled: roomData.isMCEnabled,
    currentPlaying: roomData.currentPlaying,
    ready: isInitialized,
    mcVoice: roomData.mcVoice,
    tryClaimAnnouncementLock,
  });

  // Live outro score. The hook short-circuits to null when the toggle is
  // off or there's no song, so unconditional pass-through into
  // EndScreenOverlay's `score` prop is safe.
  const songScore = useSongScore(
    roomCode,
    roomData.currentPlaying?.id ?? null,
    roomData.aiScoringEnabled,
  );

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [ytPlayer, setYtPlayer] = useState<YouTubePlayer | null>(null);
  const [isFs, setIsFs] = useState(false);
  const { visible: userActive } = useAutoHide(2500);
  const [outroActive, setOutroActive] = useState(false);
  const handleOutroVisibleChange = useCallback((v: boolean) => setOutroActive(v), []);
  // While in fullscreen the button auto-hides; otherwise it's always visible.
  const fsButtonVisible = !isFs || userActive;
  // Transport controls follow the FullscreenPlayer pattern: always visible
  // while paused (so the user can resume) and tied to userActive while
  // playing so they don't sit on top of the video forever. Hidden during
  // the MC gate so the announcement overlay stands alone, and during the
  // end-of-song outro so the celebratory headline isn't competing with
  // playback chrome.
  const showTransportControls =
    isInitialized &&
    !!roomData.currentPlaying &&
    !isMcGated &&
    !outroActive &&
    (!roomData.isPlaying || userActive);

  const hasHistory = roomData.history.length > 0;
  const hasQueue = roomData.queue.length > 0;

  useEffect(() => {
    function handleFsChange() {
      setIsFs(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      videoContainerRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  if (phase === 'lookup') {
    return (
      <TVRoomLookup
        resolveRoomCode={resolveRoomCode}
        onActivate={activateRoomByCode}
      />
    );
  }

  return (
    <main className="relative h-[100dvh] w-full flex overflow-hidden bg-black text-white">
      <BackdropLayers videoId={roomData.currentPlaying?.id} />

      <WaitingOverlay
        roomCode={roomCode}
        joinUrl={joinUrl}
        isInitialized={isInitialized}
        onActivate={initialize}
      />

      {endNotice && (
        <div className="fixed top-6 inset-x-0 z-[60] flex justify-center px-6 pointer-events-none">
          <div
            role="status"
            aria-live="polite"
            className="max-w-xl px-5 py-3 rounded-full bg-black/70 backdrop-blur-md border border-pink-400/40 text-pink-100 text-sm font-medium shadow-lg pointer-events-auto"
          >
            {endNotice}
          </div>
        </div>
      )}

      {/* Left: Video Player */}
      <section aria-label="Now playing" className="relative z-10 flex-1 min-w-0 overflow-hidden">
        <div
          ref={videoContainerRef}
          className="relative w-full h-full bg-black"
        >
          {/* Lives inside the fullscreen target so reactions remain visible
              when the video is expanded — at <main> level the layer would
              be detached from the fullscreened element and disappear. */}
          {roomCode && <EmojiLayer roomId={roomCode} />}
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-4 border-gray-700 border-t-gray-400 animate-spin" />
            </div>
          ) : isInitialized && roomData.currentPlaying ? (
            <>
              {/* Iframe stays mounted across the MC gate — its initial load
                  happens inside the user gesture from the Waiting Room tap,
                  so the play() call after the MC finishes is not blocked by
                  the browser's autoplay policy. While MC speaks we pause +
                  mute the iframe and cover it with the announcement overlay. */}
              <VideoPlayer
                key={roomData.currentPlaying.id}
                videoId={roomData.currentPlaying.id}
                onSongEnd={handleSongEnd}
                isPlaying={!isMcGated && roomData.isPlaying}
                volume={isMcGated ? 0 : roomData.volume}
                // Suppress the iframe → React sync while MC is speaking.
                // The brief PLAYING/PAUSED ping when autoplay starts and we
                // immediately pause would otherwise echo back into Firebase
                // and flip isPlaying to false.
                onPlayingChange={isMcGated ? undefined : setIsPlaying}
                onPlayerReady={setYtPlayer}
              />
              {isMcGated && (
                <MCAnnouncementOverlay
                  variant="tv"
                  title={roomData.currentPlaying.title}
                  requesterName={roomData.currentPlaying.requesterName}
                  mcText={mcText ?? undefined}
                />
              )}
              {!isMcGated && (
                <EndScreenOverlay
                  player={ytPlayer}
                  songId={roomData.currentPlaying.id}
                  nextSongTitle={roomData.queue[0]?.title ?? null}
                  onVisibleChange={handleOutroVisibleChange}
                  score={songScore}
                />
              )}
              {roomData.currentPlaying.requesterName && !isMcGated && (
                <div
                  aria-live="polite"
                  className="absolute top-3 left-3 z-20 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-sm font-semibold shadow-lg border border-white/10"
                >
                  <Mic size={14} className="text-pink-400" />
                  <span className="text-pink-300 tracking-wide">
                    {t('requester.tvLabel')}
                  </span>
                  <span className="text-white">
                    {roomData.currentPlaying.requesterName}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFs ? t('player.closeFullscreen') : t('player.openFullscreen')}
                className={`absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-gradient-brand text-white shadow-glow flex items-center justify-center active:scale-95 hover:opacity-100 transition-opacity duration-300 ${
                  fsButtonVisible ? 'opacity-80' : 'opacity-0 pointer-events-none'
                }`}
              >
                {isFs ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              {/* Center transport: prev / play-pause / next. Mirrors the
                  FullscreenPlayer layout so the TV behaves like a player,
                  not a passive display. The MC gate hides this so the
                  announcement overlay isn't competing with controls. */}
              {/* Wrapper handles overlay positioning + auto-hide; the
                  TransportControls children carry their own
                  pointer-events, so the surrounding div stays
                  click-through. */}
              <div
                className={`absolute inset-0 z-20 flex items-center justify-center gap-5 pointer-events-none transition-opacity duration-300 ${
                  showTransportControls
                    ? 'opacity-100 [&>button]:pointer-events-auto'
                    : 'opacity-0 [&>button]:pointer-events-none'
                }`}
              >
                <TransportControls
                  isPlaying={roomData.isPlaying}
                  hasHistory={hasHistory}
                  hasQueue={hasQueue}
                  onTogglePlayPause={togglePlayPause}
                  onPrev={playPrevious}
                  onNext={playNext}
                />
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <IdleQRCode roomCode={roomCode} size={280} />
            </div>
          )}
        </div>
      </section>

      <QueuePanel
        queue={roomData.queue}
        isLoading={isLoading}
        onEndParty={openEndConfirm}
      />

      <ConfirmDialog
        open={endConfirmOpen}
        title={t('tv.endPartyConfirm.title')}
        message={t('tv.endPartyConfirm.message')}
        confirmLabel={t('tv.endPartyConfirm.confirm')}
        cancelLabel={t('tv.endPartyConfirm.cancel')}
        onConfirm={confirmEndParty}
        onCancel={closeEndConfirm}
      />
    </main>
  );
}
