'use client';

import {
  Suspense,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  type CSSProperties,
} from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { LogOut, Search, ListMusic, Disc3, Settings } from 'lucide-react';
import { useRoom } from '@/hooks/useRoom';
import { useAutoRandom } from '@/hooks/useAutoRandom';
import { useTransientNotice } from '@/hooks/useTransientNotice';
import { primeAudio } from '@/hooks/useAIVoice';
import { SearchPanel } from '@/features/remote/components/SearchPanel';
import { ClientQueue } from '@/features/remote/components/ClientQueue';
import { RemoteControls } from '@/features/remote/components/RemoteControls';
import { EmojiPad } from '@/features/remote/components/EmojiPad';
import { EmojiLayer, type EmojiLayerHandle } from '@/components/EmojiLayer';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { QueueItem, YouTubeVideo } from '@/lib/youtube/types';
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

// SettingsSheet pulls in VoicePicker + AutoRandomSection + the rest of the
// settings tree (~28 KB minified). Lazy-load it on first gear-icon click so
// the queue/search-tab cold path doesn't pay for it. After first mount the
// component stays in the tree (gated by hasOpenedSettings below) so
// subsequent opens are byte-identical to before — same inert={!open} +
// slide-up transition path.
const SettingsSheet = dynamic(
  () =>
    import('@/features/remote/components/SettingsSheet').then((m) => ({
      default: m.SettingsSheet,
    })),
  { ssr: false },
);

type Tab = 'search' | 'queue' | 'player';

function RemoteInner() {
  const { t } = useTranslation();
  const {
    rawRoomCode,
    roomCode,
    activeRoom,
    pointerLoaded,
    isCoarsePointer,
    submitJoin,
    handleLeave,
  } = useRoomGate();

  const [tab, setTab] = useState<Tab>('search');
  const [playerOpen, setPlayerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const headerShift =
    tab === 'search' ? Math.min(headerHeight, Math.max(0, chromeOffset)) : 0;
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
    tryClaimAnnouncementLock,
    removeCurrentPlaying,
    addToPlayedHistory,
    setCurrentPlayingDirectly,
    playSongNow,
  } = useRoom(roomCode);

  // "Play Now" pending state: holds the video the user wants to promote
  // until they confirm. We carry the queueId separately because the queue
  // path needs the original /queue/{queueId} entry removed in the same
  // atomic update that writes /currentPlaying — see playSongNow.
  const [pendingPlayNow, setPendingPlayNow] = useState<{
    video: YouTubeVideo;
    queueId?: string;
  } | null>(null);
  const handleRequestPlayNowFromSearch = useCallback((video: YouTubeVideo) => {
    setPendingPlayNow({ video });
  }, []);
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
  const currentPlayingId = roomData.currentPlaying?.id ?? null;

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
  const handleTogglePlayPause = useCallback(() => {
    if (someoneHasSurface) {
      togglePlayPause(roomData.isPlaying);
      return;
    }
    primeAudio();
    void (async () => {
      const ok = await claim();
      if (!ok) return;
      document.documentElement.requestFullscreen?.().catch(() => {});
      setPlayerOpen(true);
      // Assert intent so the iframe will play once the MC gate (if any)
      // releases. Without this, expand-after-MC reads stale isPlaying=false.
      setIsPlaying(true);
    })();
  }, [someoneHasSurface, roomData.isPlaying, togglePlayPause, claim, setIsPlaying]);

  // Shared expand handler for the NowPlayingCard "maximize" button. Same
  // claim → fullscreen → setIsPlaying(true) sequence as the surface-less
  // togglePlayPause path: asserting isPlaying after claim is the Bug B fix.
  const handleExpand = useCallback(() => {
    primeAudio();
    void (async () => {
      const ok = await claim();
      if (!ok) return;
      document.documentElement.requestFullscreen?.().catch(() => {});
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
      void release();
      setPlayerOpen(false);
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

          {isCoarsePointer === null ? (
            // Pointer detection runs post-mount; show a sized skeleton so
            // the layout doesn't jump while the JoinForm decides what to
            // render. Both mobile and desktop land on JoinForm next —
            // joining a room always requires an explicit user gesture.
            <div className="w-full h-[260px] rounded-3xl border border-border bg-surface/70 backdrop-blur-md shadow-glow" />
          ) : (
            <JoinForm
              activeRoom={activeRoom}
              pointerLoaded={pointerLoaded}
              onJoin={submitJoin}
            />
          )}
        </div>
      </main>
    );
  }

  const tabs: { id: Tab; labelKey: string; Icon: typeof Search }[] = [
    { id: 'search', labelKey: 'tabs.search', Icon: Search },
    { id: 'queue', labelKey: 'tabs.queue', Icon: ListMusic },
    { id: 'player', labelKey: 'tabs.player', Icon: Disc3 },
  ];

  return (
    <main className="relative h-[100dvh] w-full flex flex-col overflow-hidden bg-bg text-fg">
      {noticeBanner}
      <h1 className="sr-only">{t('home.appHeading')}</h1>

      <header
        ref={headerRef}
        style={headerStyle}
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-surface/70 backdrop-blur-md border-b border-border will-change-transform lg:static lg:z-auto lg:shrink-0 lg:[transform:none]! ${
          headerSnap
            ? 'transition-transform duration-300 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] lg:transition-none!'
            : ''
        }`}
      >
        <button
          onClick={handleLeave}
          className="-m-2 p-2 sm:m-0 sm:p-0 flex items-center gap-1.5 text-sm text-muted hover:text-danger transition-colors"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">{t('header.leaveButton')}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted">
            {t('header.roomLabel')}
          </span>
          <span
            className="tabular px-3 py-1 text-sm font-bold text-white bg-gradient-brand rounded-full tracking-[0.3em] shadow-glow"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {roomCode}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setHasOpenedSettings(true);
            setSettingsOpen(true);
          }}
          aria-label={t('settings.openLabel')}
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-fg hover:bg-surface-2 active:scale-95 transition"
        >
          <Settings size={18} strokeWidth={2.2} />
          {roomData.isAutoRandomMode && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-gradient-brand shadow-glow"
            />
          )}
        </button>
      </header>

      {/* Main content: mobile shows one tab at a time; lg+ shows two columns */}
      <div
        style={{ '--header-h': `${headerHeight}px` } as CSSProperties}
        className="flex-1 min-h-0 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_460px] xl:grid-cols-[minmax(0,1fr)_500px]"
      >
        {/* Search column */}
        <section
          aria-label="Search"
          className={`min-h-0 overflow-hidden lg:block lg:border-r lg:border-border ${
            tab === 'search' ? 'h-full' : 'hidden'
          }`}
        >
          <SearchPanel
            onAdd={handleAddToQueue}
            onRemove={removeSong}
            onPlayNow={handleRequestPlayNowFromSearch}
            queuedMap={queuedMap}
            currentPlayingId={currentPlayingId}
            isQueueLoading={isLoading}
            headerHeight={headerHeight}
            onChromeChange={handleChromeChange}
          />
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
            setPlayerOpen(false);
            void release();
          }}
          onPrev={playPrevious}
          onNext={playNext}
          onPlayingChange={setIsPlaying}
          nextSongTitle={roomData.queue[0]?.title ?? null}
        />
      )}

      {/* Mobile bottom tab bar */}
      <nav
        role="tablist"
        aria-label="Sections"
        className="lg:hidden shrink-0 grid grid-cols-3 bg-surface/85 backdrop-blur-md border-t border-border"
      >
        {tabs.map(({ id, labelKey, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active ? 'text-fg' : 'text-muted hover:text-fg'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full bg-gradient-brand shadow-glow"
                />
              )}
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              <span className={active ? 'text-gradient-brand' : ''}>{t(labelKey)}</span>
            </button>
          );
        })}
      </nav>

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
        song={toastSong}
        onViewQueue={() => {
          setTab('queue');
          dismissToast();
        }}
        onDismiss={dismissToast}
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
