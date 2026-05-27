'use client';

import {
  Suspense,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  type CSSProperties,
} from 'react';
import { useTabParam } from '@/features/remote/hooks/useTabParam';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { useRoom } from '@bs-kara/shared/hooks';
import { useAutoRandom } from '@/hooks/useAutoRandom';
import { useTransientNotice } from '@bs-kara/shared/hooks';
import { primeAudio } from '@/hooks/useAIVoice';
import { TopBar } from '@/features/remote/components/TopBar';
import { BottomNav } from '@/features/remote/components/BottomNav';
import { SearchPanel } from '@/features/remote/components/SearchPanel';
import { ClientQueue } from '@/features/remote/components/ClientQueue';
import { RemoteControls } from '@/features/remote/components/RemoteControls';
import { EmojiPad } from '@/features/remote/components/EmojiPad';
import { EmojiLayer, type EmojiLayerHandle } from '@/components/EmojiLayer';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { QueueItem, YouTubeVideo } from '@bs-kara/shared';
import { NowPlayingCard } from '@/features/remote/components/NowPlayingCard';
import { FullscreenPlayer } from '@/features/remote/components/FullscreenPlayer';
import { NeonOrbs } from '@/features/remote/components/NeonOrbs';
import { ThemeToggle } from '@/features/remote/components/ThemeToggle';
import { AddedToast } from '@/features/remote/components/AddedToast';
import { RequesterDialog } from '@/features/remote/components/RequesterDialog';
import { JoinForm } from '@/features/remote/components/JoinForm';
import { useRoomGate } from '@/features/remote/hooks/useRoomGate';
import { useRequesterDialog } from '@/features/remote/hooks/useRequesterDialog';
import { useQueuedMap } from '@/features/remote/hooks/useQueuedMap';
import { useFullscreenOwnership } from '@/features/remote/hooks/useFullscreenOwnership';
import { useInactivityTimeout } from '@/features/remote/hooks/useInactivityTimeout';
import { useCurrentHost } from '@/features/remote/hooks/useCurrentHost';
import { useHostAuth } from '@/features/remote/hooks/useHostAuth';
import { SessionExpiredOverlay } from '@/features/remote/components/SessionExpiredOverlay';

import {
  QueueSkeleton,
  PlayerSkeleton,
  SearchSkeleton,
  SettingsSkeleton,
} from '@/features/remote/components/skeletons';

// SettingsSheet pulls in VoicePicker + AutoRandomSection + the rest of the
// settings tree (~28 KB minified). Lazy-load both the desktop sheet wrapper
// and the mobile-tab panel from the same chunk so the queue/search-tab cold
// path doesn't pay for it. After first mount each stays in the tree (gated
// by hasOpenedSettings below) so subsequent opens are byte-identical to
// before — same inert={!open} + slide-up transition path on desktop, same
// hidden/h-full toggle as the other tab panels on mobile.
const SettingsSheet = dynamic(
  () =>
    import('@/features/remote/components/SettingsSheet').then((m) => ({
      default: m.SettingsSheet,
    })),
  { ssr: false, loading: () => <SettingsSkeleton /> },
);
const SettingsPanel = dynamic(
  () =>
    import('@/features/remote/components/SettingsSheet').then((m) => ({
      default: m.SettingsPanel,
    })),
  { ssr: false, loading: () => <SettingsSkeleton /> },
);

function RemoteInner() {
  const { t } = useTranslation();
  const {
    rawRoomCode,
    roomCode,
    isCoarsePointer,
    joinError,
    isJoining,
    submitJoin,
    handleLeave,
  } = useRoomGate();

  const { timedOut, rejoinReason, resetActivity, rejoin } = useInactivityTimeout(roomCode);
  const { profile: hostProfile, loading: hostLoading } = useCurrentHost();

  const [tab, setTab] = useTabParam();
  const [playerOpen, setPlayerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const emojiLayerRef = useRef<EmojiLayerHandle>(null);
  // Scroll-coupled chrome auto-hide. SearchPanel's results scroll drives a
  // px offset (0..headerHeight + searchBarHeight) that translates the
  // header and the search bar 1:1 with the gesture; `chromeSnap` is true
  // only during the brief snap-to-rest transition at the end of a scroll.
  // Gated on the search tab so we don't apply the inline transform when
  // the user is on the queue tab and SearchPanel is hidden.
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  useLayoutEffect(() => {
    if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
  }, []);

  const [chromeOffset, setChromeOffset] = useState(0);
  const [chromeSnap, setChromeSnap] = useState(false);
  const handleChromeChange = useCallback((offset: number, snap: boolean) => {
    setChromeOffset(offset);
    setChromeSnap(snap);
  }, []);

  // When the search input is focused on mobile we want to reclaim every pixel
  // for the keyboard + results: the header slides fully off-screen and the
  // spacer inside SearchPanel (which reserves room for the absolute header)
  // shrinks to zero. On desktop (lg+) the header is static and unaffected.
  const searchFocusHide = tab === 'search' && isSearchFocused;
  // The spacer that SearchPanel adds for the absolute header must be 0 when
  // we've hidden it; otherwise the top of the results list has dead space.
  const effectiveHeaderHeight = searchFocusHide ? 0 : headerHeight;

  const headerShift = searchFocusHide
    ? headerHeight // fully above viewport
    : tab === 'search' ? Math.min(headerHeight, Math.max(0, chromeOffset)) : 0;
  const headerSnap = tab === 'search' && chromeSnap;
  // Header is absolutely positioned on mobile (see className below) and
  // floats above the list on its own layer, so retraction is pure
  // translateY — no margin animation, no list reflow. The flex-1 content
  // area below is padded by --header-h to keep its content clear of the
  // header's resting position.
  const headerStyle: CSSProperties = {
    transform: `translateY(-${headerShift}px)`,
  };
  // Latches true on the first gear-icon click and stays true for the rest of
  // the session. Gates the dynamic-imported SettingsSheet so it doesn't
  // mount (and doesn't fetch its chunk) until the user actually opens it.
  const [hasOpenedSettings, setHasOpenedSettings] = useState(false);
  const {
    roomData,
    isLoading,
    roomExists,
    addSongToQueue,
    updateRequesterName,
    removeSong,
    reorderQueue,
    togglePlayPause,
    setIsPlaying,
    playNext,
    playPrevious,
    sendEmoji,
    setAutoRandomMode,
    setRandomFilters,
    setDragDropEnabled,
    setRequesterPromptEnabled,
    setMCEnabled,
    setAiScoringEnabled,
    setMcVoice,
    setGuestCanRemove,
    tryClaimAnnouncementLock,
    removeCurrentPlaying,
    addToPlayedHistory,
    setCurrentPlayingDirectly,
    playSongNow,
  } = useRoom(roomCode);

  const { isHost } = useHostAuth(roomData.hostUid);

  // "Play Now" pending state: holds the video the user wants to promote
  // until they confirm. We carry the queueId separately because the queue
  // path needs the original /queue/{queueId} entry removed in the same
  // atomic update that writes /currentPlaying — see playSongNow.
  const [pendingPlayNow, setPendingPlayNow] = useState<{
    video: YouTubeVideo;
    queueId?: string;
  } | null>(null);
  const handleRequestPlayNowFromQueue = useCallback((item: QueueItem) => {
    setPendingPlayNow({ video: item, queueId: item.queueId });
  }, []);
  const handleConfirmPlayNow = useCallback(() => {
    if (pendingPlayNow) {
      void playSongNow(pendingPlayNow.video, pendingPlayNow.queueId);
    }
    setPendingPlayNow(null);
  }, [pendingPlayNow, playSongNow]);
  const handleCancelPlayNow = useCallback(() => setPendingPlayNow(null), []);

  // Mobile drives auto-random whenever a room is joined, so the room never
  // goes silent even when no TV is connected. The TV (if also open) drives
  // it too — both clients have an internal busy ref, and the second client's
  // effect bails as soon as Firebase reports a song landed in currentPlaying.
  useAutoRandom({
    enabled: roomData.isAutoRandomMode,
    ready: !!roomCode,
    hasCurrentPlaying: !!roomData.currentPlaying,
    queueLength: roomData.queue.length,
    randomFilters: roomData.randomFilters,
    playedHistory: roomData.playedHistory,
    setCurrentPlayingDirectly,
    addToPlayedHistory,
  });

  // Auto-promote queue[0] → currentPlaying when nothing is playing. The TV
  // already does this; mirroring it here makes mobile-only sessions
  // self-sufficient: a freshly added song starts playing immediately
  // instead of sitting in the queue waiting for a host that never appears.
  // playNext is idempotent against the same queue state, so even if the
  // TV is also open and races us, nothing breaks.
  useEffect(() => {
    if (!roomCode) return;
    if (roomData.currentPlaying) return;
    if (roomData.queue.length === 0) return;
    playNext();
  }, [roomCode, roomData.currentPlaying, roomData.queue.length, playNext]);

  // True when the URL points at a room that can't be entered: either a
  // malformed code, or a 4-digit code Firebase says doesn't exist.
  const roomMissing =
    (!!rawRoomCode && !roomCode) || (!!roomCode && roomExists === false);

  // Inline toast for transient notices (e.g. "the room you were in has
  // ended"). Lives next to the rest of the home/main UI rather than the
  // not-found panel that used to occupy this space.
  const { notice, show: showNotice } = useTransientNotice(4000);

  // When the TV ends the party (or the URL points at a stale/bad code), drop
  // back to home and surface a toast so the user understands why.
  useEffect(() => {
    if (!roomMissing) return;
    showNotice(t('errors.roomNotFound.message'));
    handleLeave();
  }, [roomMissing, handleLeave, showNotice, t]);

  // End-Party toast: the TV writes `lastEndedAt` when it resets the room.
  // We seed the ref with whatever value Firebase reports on the first
  // snapshot so historical resets (or rejoining after the fact) don't
  // re-trigger the toast — only forward jumps that happen while we're
  // connected fire the notice.
  const lastEndedSeenRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const value = roomData.lastEndedAt;
    if (lastEndedSeenRef.current === undefined) {
      lastEndedSeenRef.current = value;
      return;
    }
    if (value && value !== lastEndedSeenRef.current) {
      lastEndedSeenRef.current = value;
      showNotice(t('tv.endPartyNotice'));
    }
  }, [roomData.lastEndedAt, showNotice, t]);

  // Reset the seen marker when the room changes so a fresh subscribe
  // re-seeds against the new room's history instead of replaying it.
  useEffect(() => {
    lastEndedSeenRef.current = undefined;
  }, [roomCode]);

  // Playback events count as activity — reset the inactivity timer when
  // the playing state or the current song changes.
  useEffect(() => {
    if (!roomCode) return;
    resetActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, roomData.isPlaying, roomData.currentPlaying?.id]);

  const {
    handleAddToQueue,
    handleEditRequester,
    handleRequesterConfirm,
    closeRequesterDialog,
    dialogOpen,
    dialogMode,
    dialogKey,
    dialogInitialName,
    toastSong,
    dismissToast,
  } = useRequesterDialog({
    addSongToQueue,
    updateRequesterName,
    requesterPromptEnabled: roomData.requesterPromptEnabled,
  });

  // Optimistic emoji feedback: fire the local rise instantly so the tapper
  // sees acknowledgement well under 100ms, regardless of network. EmojiLayer
  // dedupes the Firebase echo so this never double-renders.
  const handleSendEmoji = useCallback(
    (emoji: string) => {
      emojiLayerRef.current?.pushLocal(emoji);
      sendEmoji(emoji);
    },
    [sendEmoji],
  );

  const queuedMap = useQueuedMap(roomData.queue);
  const queuePositionMap = useMemo(
    () => new Map(roomData.queue.map((item, i) => [item.id, i + 1])),
    [roomData.queue],
  );
  const currentPlayingId = roomData.currentPlaying?.id ?? null;

  // Enrich the toast song with queueId + queue position so AddedToast can
  // display position and offer an undo action. Look up by video id in the
  // live queue snapshot; falls back to null if the song isn't in the queue
  // yet (e.g. it went straight to currentPlaying).
  const toastSongWithMeta = (() => {
    if (!toastSong) return null;
    const idx = roomData.queue.findIndex((q) => q.id === toastSong.id);
    if (idx === -1) return null;
    const item = roomData.queue[idx];
    return { ...toastSong, queueId: item.queueId, queuePos: idx + 1 };
  })();

  const { deviceId, claim, release } = useFullscreenOwnership(roomCode);

  // Cluster-wide view: any device (TV or a phone holding the
  // fullscreenOwner lock) counts as "the cluster has a playback surface".
  // displayedIsPlaying must trust Firebase whenever that's true, so a
  // remote-control phone reflects the host's play/pause state instead of
  // being clamped to "paused".
  const someoneHasSurface =
    roomData.isTvActive || roomData.fullscreenOwner !== null;
  const iAmFullscreenOwner = roomData.fullscreenOwner === deviceId;
  const displayedIsPlaying = someoneHasSurface ? roomData.isPlaying : false;

  // Tapping play/pause on a phone that already has a host (TV or another
  // phone) is a pure remote-control gesture — write Firebase, do not open
  // local fullscreen. With no host in the cluster, this phone must claim
  // the lock and become the host before opening its own surface.
  //
  // requestFullscreen MUST run synchronously inside the click handler,
  // before the `await claim()`. After an await the user-gesture activation
  // is consumed and the engine either rejects the request outright or
  // briefly enters fullscreen and exits as untrusted — FullscreenPlayer's
  // own fullscreenchange listener then interprets that exit as an explicit
  // close. If the claim later loses the race, exit fullscreen as cleanup.
  const handleTogglePlayPause = useCallback(() => {
    if (someoneHasSurface) {
      togglePlayPause(roomData.isPlaying);
      return;
    }
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
  }, [someoneHasSurface, roomData.isPlaying, togglePlayPause, claim, setIsPlaying]);

  // Shared expand handler for the NowPlayingCard "maximize" button. Same
  // sync-fullscreen-then-claim sequence as the surface-less togglePlayPause
  // path above; see the comment there for why requestFullscreen cannot
  // wait for the claim. Asserting isPlaying after claim is the Bug B fix.
  const handleExpand = useCallback(() => {
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
      setIsPlaying(true);
    })();
  }, [claim, setIsPlaying]);

  // True when another phone currently owns the surface — TV authority is
  // already handled by hiding onExpand when isTvActive.
  // TODO: NowPlayingCard does not yet support a `disabled` / `disabledReason`
  // prop. Once it does, surface this state in the UI with a sublabel like
  // "Đang xem trên thiết bị khác" instead of hiding the button.
  const isExpandBlocked = roomData.isTvActive
    ? false
    : roomData.fullscreenOwner !== null && !iAmFullscreenOwner;

  // TV came online while we held the phone-side fullscreen lock: drop the
  // claim and close the local surface so the TV takes over cleanly. The TV
  // doesn't write fullscreenOwner; isTvActive alone is enough to make
  // someoneHasSurface true, so other phones already see the cluster as hosted.
  useEffect(() => {
    if (roomData.isTvActive && iAmFullscreenOwner) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      void release().then(() => setPlayerOpen(false));
    }
  }, [roomData.isTvActive, iAmFullscreenOwner, release]);

  const noticeBanner = notice ? (
    <div className="fixed top-4 inset-x-0 z-[60] flex justify-center px-16 sm:px-4 pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className="max-w-md px-4 py-2.5 rounded-2xl sm:rounded-full bg-surface-2 border border-glow/40 shadow-glow text-sm text-fg text-center pointer-events-auto"
      >
        {notice}
      </div>
    </div>
  ) : null;

  if (!roomCode) {
    return (
      <main className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center px-6 py-10 overflow-hidden bg-bg text-fg">
        {noticeBanner}
        <NeonOrbs />

        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle />
        </div>

        <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted mb-3">
            {t('home.appHeading')}
          </p>
          <h1
            className="text-gradient-brand text-4xl sm:text-5xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('home.wordmark')}
          </h1>
          <p className="text-sm sm:text-base text-muted mb-8">{t('home.tagline')}</p>

          {isCoarsePointer === null || hostLoading ? (
            <div className="w-full h-[260px] rounded-3xl border border-border bg-surface/70 backdrop-blur-md shadow-glow" />
          ) : (
            <div className="w-full flex flex-col gap-4">
              {/* Host path — navigate directly; the guest-access API must
                not gate the owner from their own room. */}
              {hostProfile ? (
                <Link
                  href={`/?room=${hostProfile.roomCode}`}
                  className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] text-center block"
                >
                  {t('auth.goToMyRoom')}
                </Link>
              ) : (
                <Link
                  href="/register"
                  className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] text-center block"
                >
                  {t('auth.loginOrRegister')}
                </Link>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted uppercase tracking-widest">
                  {t('auth.orDivider')}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Guest path — JoinForm provides its own card */}
              <JoinForm
                onJoin={submitJoin}
                joinError={joinError}
                isJoining={isJoining}
              />
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative h-[100dvh] w-full flex flex-col overflow-hidden bg-bg text-fg"
      onPointerDown={resetActivity}
    >
      {noticeBanner}
      <h1 className="sr-only">{t('home.appHeading')}</h1>

      <header
        ref={headerRef}
        style={headerStyle}
        className={`absolute top-0 left-0 right-0 z-30 flex items-center bg-surface/70 backdrop-blur-md border-b border-border will-change-transform lg:static lg:z-auto lg:shrink-0 lg:[transform:none]! ${
          searchFocusHide || headerSnap
            ? `transition-transform lg:transition-none! ${headerSnap ? 'duration-300 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]' : 'duration-200'}`
            : ''
        }`}
      >
        <div className="flex-1 min-w-0">
          <TopBar roomCode={roomCode} />
        </div>

        {/* Settings trigger — desktop only (mobile uses BottomNav "Cài đặt" tab) */}
        <button
          type="button"
          onClick={() => { setHasOpenedSettings(true); setSettingsOpen(true); }}
          aria-label={t('settings.title')}
          className="hidden lg:flex mr-3 w-9 h-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg transition-colors"
        >
          <Settings size={18} />
        </button>
      </header>

      {/* Main content: mobile shows one tab at a time; lg+ shows two columns */}
      <div
        style={{ '--header-h': `${effectiveHeaderHeight}px` } as CSSProperties}
        className="flex-1 min-h-0 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_460px] xl:grid-cols-[minmax(0,1fr)_500px]"
      >
        {/* Search column */}
        <section
          aria-label="Search"
          className={`min-h-0 overflow-hidden lg:block lg:border-r lg:border-border ${
            tab === 'search' ? 'h-full' : 'hidden'
          }`}
        >
          {isLoading ? (
            <SearchSkeleton />
          ) : (
            <SearchPanel
              onAdd={handleAddToQueue}
              queuedMap={queuedMap}
              queuePositionMap={queuePositionMap}
              currentPlayingId={currentPlayingId}
              headerHeight={effectiveHeaderHeight}
              onChromeChange={handleChromeChange}
              onFocusChange={setIsSearchFocused}
            />
          )}
        </section>

        {/* Queue / player column — on desktop everything stacks together;
            on mobile the queue stays on its own tab and the now-playing
            card + emoji pad + transport controls move to the "player" tab
            so the queue tab stays uncluttered. */}
        <section
          aria-label="Queue and controls"
          className={`relative min-h-0 flex-col overflow-hidden pt-[var(--header-h)] lg:pt-0 lg:flex lg:bg-surface/40 ${
            tab === 'queue' || tab === 'player' ? 'flex h-full' : 'hidden'
          }`}
        >
          {isLoading ? (
            tab === 'player' ? <PlayerSkeleton /> : <QueueSkeleton />
          ) : (
            <>
              {/* The card always renders when a song is playing — even when the
                  TV is showing it — so the phone still feels like the remote.
                  When the TV is active we drop `onExpand`, which both disables
                  the tap-to-expand gesture and hides the Maximize button so
                  the user isn't offered a fullscreen mode that would compete
                  with the TV. */}
              {roomData.currentPlaying && (
                <>
                  <div className="px-3 pt-3 pb-1 hidden lg:block">
                    <NowPlayingCard
                      track={roomData.currentPlaying}
                      isPlaying={displayedIsPlaying}
                      onExpand={
                        roomData.isTvActive || isExpandBlocked
                          ? undefined
                          : handleExpand
                      }
                      onRemove={removeCurrentPlaying}
                    />
                  </div>
                  <div
                    className={`flex-1 min-h-0 overflow-y-auto ${
                      tab === 'player' ? 'lg:hidden' : 'hidden'
                    }`}
                  >
                    {/* min-h-full + flex centers the card vertically on tall
                        screens; when the card is taller than the viewport
                        (small phones, in-app browsers, landscape), the inner
                        block grows past the parent and the parent's
                        `overflow-y-auto` lets the user scroll to see all of
                        it. */}
                    <div className="min-h-full w-full flex items-center justify-center py-6">
                      <NowPlayingCard
                        variant="hero"
                        track={roomData.currentPlaying}
                        isPlaying={displayedIsPlaying}
                        onExpand={
                          roomData.isTvActive || isExpandBlocked
                            ? undefined
                            : handleExpand
                        }
                        onRemove={removeCurrentPlaying}
                      />
                    </div>
                  </div>
                </>
              )}
              {/* Empty-state for the player tab when nothing is playing — gives
                  the controls something to sit under so the area doesn't
                  collapse into a thin strip. */}
              {!roomData.currentPlaying && (
                <div
                  className={`flex-1 min-h-0 flex items-center justify-center px-6 text-center ${
                    tab === 'player' ? 'lg:hidden' : 'hidden'
                  }`}
                >
                  <p className="text-sm text-muted max-w-[260px]">
                    {t('player.idleHint')}
                  </p>
                </div>
              )}
              <div
                className={`flex-1 min-h-0 overflow-hidden ${
                  tab === 'queue' ? '' : 'hidden lg:block'
                }`}
              >
                <ClientQueue
                  items={roomData.queue}
                  isLoading={isLoading}
                  onReorder={reorderQueue}
                  onRemove={removeSong}
                  onEditRequester={
                    roomData.requesterPromptEnabled ? handleEditRequester : undefined
                  }
                  onPlayNow={handleRequestPlayNowFromQueue}
                  currentPlayingId={currentPlayingId}
                  dragDropEnabled={roomData.dragDropEnabled}
                  isHost={isHost}
                  guestCanRemove={roomData.guestCanRemove}
                />
              </div>
              {/* Optimistic emoji overlay. Sits above the player content, below
                  the controls bar (bottom offset clears EmojiPad + RemoteControls
                  + safe-area on mobile, ~28 lg). Hidden on mobile when not on
                  the player tab so the queue tab doesn't render unrelated rises. */}
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-x-0 top-[var(--header-h)] bottom-28 lg:top-0 lg:bottom-32 z-40 overflow-hidden ${
                  tab === 'player' ? '' : 'hidden lg:block'
                }`}
              >
                <EmojiLayer ref={emojiLayerRef} roomId={roomCode} />
              </div>
              <div
                className={`shrink-0 bg-surface/85 backdrop-blur-md border-t border-border ${
                  tab === 'player' ? '' : 'hidden lg:block'
                }`}
              >
                <EmojiPad onSendEmoji={handleSendEmoji} />
                <RemoteControls
                  isPlaying={displayedIsPlaying}
                  hasHistory={roomData.history.length > 0}
                  hasQueue={roomData.queue.length > 0}
                  currentPlaying={roomData.currentPlaying}
                  onTogglePlayPause={handleTogglePlayPause}
                  onPrev={playPrevious}
                  onNext={playNext}
                />
              </div>
            </>
          )}
        </section>

        {/* Settings — mobile-only tab panel. Desktop opens the gear-icon
            modal in the header instead, so this is `lg:hidden`. Gated on
            hasOpenedSettings so the dynamic-imported chunk doesn't load
            until the user taps the tab (matches the desktop sheet's
            lazy-mount latch). */}
        <section
          aria-label="Settings"
          className={`min-h-0 overflow-hidden pt-[var(--header-h)] lg:hidden ${
            tab === 'settings' ? 'h-full' : 'hidden'
          }`}
        >
          {isLoading ? (
            <SettingsSkeleton />
          ) : (
            hasOpenedSettings && (
              <SettingsPanel
                roomCode={roomCode}
                autoRandomEnabled={roomData.isAutoRandomMode}
                filters={roomData.randomFilters}
                onAutoRandomToggle={setAutoRandomMode}
                onFiltersChange={setRandomFilters}
                dragDropEnabled={roomData.dragDropEnabled}
                onDragDropToggle={setDragDropEnabled}
                requesterPromptEnabled={roomData.requesterPromptEnabled}
                onRequesterPromptToggle={setRequesterPromptEnabled}
                mcEnabled={roomData.isMCEnabled}
                onMCToggle={setMCEnabled}
                mcVoice={roomData.mcVoice}
                onMcVoiceChange={setMcVoice}
                aiScoringEnabled={roomData.aiScoringEnabled}
                onAiScoringToggle={setAiScoringEnabled}
                isHost={isHost}
                guestCanRemove={roomData.guestCanRemove}
                onGuestCanRemoveToggle={setGuestCanRemove}
                panelOpen={tab === 'settings'}
                onLeave={handleLeave}
              />
            )
          )}
        </section>
      </div>

      {/* FullscreenPlayer stays mounted as long as the user has opened it.
          When `currentPlaying` flips null (song ended, queue empty) the
          player renders an idle state instead of unmounting, so the user
          keeps their fullscreen surface and the iframe resumes seamlessly
          when the next song lands. Only the explicit close button
          (`onClose`) tears it down. */}
      {playerOpen && (
        <FullscreenPlayer
          track={roomData.currentPlaying ?? null}
          roomId={roomCode}
          isPlaying={roomData.isPlaying}
          volume={roomData.volume}
          hasHistory={roomData.history.length > 0}
          hasQueue={roomData.queue.length > 0}
          isMCEnabled={roomData.isMCEnabled}
          mcVoice={roomData.mcVoice}
          aiScoringEnabled={roomData.aiScoringEnabled}
          // Only consult the cross-device lock when the TV is actually
          // racing us. Without this, a stale lastAnnouncedSongId from a
          // prior session makes the claim fail and the gate releases
          // immediately — the video plays without an announcement.
          tryClaimAnnouncementLock={
            roomData.isTvActive ? tryClaimAnnouncementLock : undefined
          }
          onSongEnd={playNext}
          onClose={() => {
            // Exit native fullscreen here (the parent owns this; see the
            // long comment in FullscreenPlayer near the removed cleanup
            // for why FullscreenPlayer must NOT do this from a useEffect
            // teardown). Idempotent — fullscreenElement is null if the
            // user just hit ESC / swiped to leave fullscreen, in which
            // case the close-on-fs-exit listener routed us here.
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
            }
            setPlayerOpen(false);
            void release();
          }}
          onPrev={playPrevious}
          onNext={playNext}
          onPlayingChange={setIsPlaying}
          nextSongTitle={roomData.queue[0]?.title ?? null}
        />
      )}

      <SessionExpiredOverlay
        timedOut={timedOut}
        rejoinReason={rejoinReason}
        onRejoin={() => { void rejoin(); }}
      />

      {/* Mobile bottom tab bar — collapses when the search input is focused
          so the keyboard + results have maximum vertical space. */}
      <div className={`lg:hidden overflow-hidden transition-[max-height] duration-200 ease-out ${
        tab === 'search' && isSearchFocused ? 'max-h-0' : 'max-h-24'
      }`}>
        <BottomNav
          activeTab={tab}
          queueLength={roomData.queue.length}
          isPlaying={displayedIsPlaying}
          onTabChange={(t) => {
            // Flip the lazy-mount latch the first time the user steps onto
            // the settings tab so the SettingsPanel chunk loads on demand.
            if (t === 'settings') setHasOpenedSettings(true);
            setTab(t);
          }}
        />
      </div>

      {hasOpenedSettings && (
        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          roomCode={roomCode}
          autoRandomEnabled={roomData.isAutoRandomMode}
          filters={roomData.randomFilters}
          onAutoRandomToggle={setAutoRandomMode}
          onFiltersChange={setRandomFilters}
          dragDropEnabled={roomData.dragDropEnabled}
          onDragDropToggle={setDragDropEnabled}
          requesterPromptEnabled={roomData.requesterPromptEnabled}
          onRequesterPromptToggle={setRequesterPromptEnabled}
          mcEnabled={roomData.isMCEnabled}
          onMCToggle={setMCEnabled}
          mcVoice={roomData.mcVoice}
          onMcVoiceChange={setMcVoice}
          aiScoringEnabled={roomData.aiScoringEnabled}
          onAiScoringToggle={setAiScoringEnabled}
          isHost={isHost}
          guestCanRemove={roomData.guestCanRemove}
          onGuestCanRemoveToggle={setGuestCanRemove}
          onLeave={handleLeave}
        />
      )}

      <RequesterDialog
        key={dialogKey}
        open={dialogOpen}
        initialName={dialogInitialName}
        mode={dialogMode}
        onConfirm={handleRequesterConfirm}
        onCancel={closeRequesterDialog}
      />

      <AddedToast
        song={toastSongWithMeta}
        onUndo={(queueId) => {
          removeSong(queueId);
          dismissToast();
        }}
        onViewQueue={() => {
          setTab('queue');
          dismissToast();
        }}
      />

      <ConfirmDialog
        open={pendingPlayNow !== null}
        variant="brand"
        title={t('playNow.title')}
        message={t('playNow.message', { title: pendingPlayNow?.video.title ?? '' })}
        confirmLabel={t('playNow.confirm')}
        cancelLabel={t('playNow.cancel')}
        onConfirm={handleConfirmPlayNow}
        onCancel={handleCancelPlayNow}
      />
    </main>
  );
}

export default function RemoteClient() {
  return (
    <Suspense>
      <RemoteInner />
    </Suspense>
  );
}
