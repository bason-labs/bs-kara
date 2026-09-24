'use client';

import {
  Suspense,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type CSSProperties,
} from 'react';
import { useTabParam } from '@/features/remote/hooks/useTabParam';
import { useSearchModeParam } from '@/features/remote/hooks/useSearchModeParam';
import { useVoiceConversation } from '@/features/remote/hooks/useVoiceConversation';
import { SearchModeSwitch } from '@/features/remote/components/SearchModeSwitch';
import { VoiceChatPanel } from '@/features/remote/components/VoiceChatPanel';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { useRoom } from '@bs-kara/shared/hooks';
import { useAutoRandom } from '@/hooks/useAutoRandom';
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
import { AddedToast } from '@/features/remote/components/AddedToast';
import { RequesterDialog } from '@/features/remote/components/RequesterDialog';
import { HomeScreen } from '@/features/remote/components/HomeScreen';
import { NoticeBanner } from '@/features/remote/components/NoticeBanner';
import { useRoomGate } from '@/features/remote/hooks/useRoomGate';
import { useRequesterDialog } from '@/features/remote/hooks/useRequesterDialog';
import { useQueuedMap } from '@/features/remote/hooks/useQueuedMap';
import { usePlaybackSurface } from '@/features/remote/hooks/usePlaybackSurface';
import { useRoomNotices } from '@/features/remote/hooks/useRoomNotices';
import { useHeaderAutoHide } from '@/features/remote/hooks/useHeaderAutoHide';
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
// Desktop modal: the gear-icon click latches `hasOpenedSettings` and mounts
// this dynamic component. Returning `null` for the loading fallback skips
// the chrome-less skeleton flash — the modal simply pops in once the chunk
// arrives (typically <100 ms on warm cache, single round-trip on cold).
const SettingsSheet = dynamic(
  () =>
    import('@/features/remote/components/SettingsSheet').then((m) => ({
      default: m.SettingsSheet,
    })),
  { ssr: false, loading: () => null },
);
const SettingsPanel = dynamic(
  () =>
    import('@/features/remote/components/SettingsSheet').then((m) => ({
      default: m.SettingsPanel,
    })),
  { ssr: false, loading: () => <SettingsSkeleton /> },
);

function RemoteInner() {
  const { t, i18n } = useTranslation();
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
  const [searchMode, setSearchMode] = useSearchModeParam();
  const voiceConversation = useVoiceConversation(roomCode, (i18n?.language ?? 'vi').startsWith('en') ? 'en' : 'vi', resetActivity);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const emojiLayerRef = useRef<EmojiLayerHandle>(null);
  const {
    headerRef,
    headerStyle,
    searchFocusHide,
    headerSnap,
    effectiveHeaderHeight,
    handleChromeChange,
  } = useHeaderAutoHide({
    onManualSearch: tab === 'search' && searchMode === 'manual',
    isSearchFocused,
  });
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
    setVoiceChatEnabled,
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

  const voiceChatAvailable = roomExists === true && roomData.voiceChatEnabled;
  const effectiveSearchMode = voiceChatAvailable ? searchMode : 'manual';
  useEffect(() => {
    if (roomExists === true && !roomData.voiceChatEnabled && searchMode !== 'manual') {
      setSearchMode('manual');
    }
  }, [roomData.voiceChatEnabled, roomExists, searchMode, setSearchMode]);

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

  // Inline toast for transient notices ("the room you were in has ended", …).
  const notice = useRoomNotices({
    roomCode,
    roomMissing,
    lastEndedAt: roomData.lastEndedAt,
    handleLeave,
  });

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

  const {
    playerOpen,
    displayedIsPlaying,
    isExpandBlocked,
    handleTogglePlayPause,
    handleExpand,
    closePlayer,
  } = usePlaybackSurface({
    roomCode,
    isTvActive: roomData.isTvActive,
    fullscreenOwner: roomData.fullscreenOwner,
    isPlaying: roomData.isPlaying,
    togglePlayPause,
    setIsPlaying,
  });


  if (!roomCode) {
    return (
      <HomeScreen
        notice={notice}
        isCoarsePointer={isCoarsePointer}
        hostProfile={hostProfile}
        hostLoading={hostLoading}
        onJoin={submitJoin}
        joinError={joinError}
        isJoining={isJoining}
      />
    );
  }

  // The mobile settings tab and the desktop settings modal show the same controls.
  const settingsProps = {
    roomCode,
    autoRandomEnabled: roomData.isAutoRandomMode,
    filters: roomData.randomFilters,
    onAutoRandomToggle: setAutoRandomMode,
    onFiltersChange: setRandomFilters,
    dragDropEnabled: roomData.dragDropEnabled,
    onDragDropToggle: setDragDropEnabled,
    requesterPromptEnabled: roomData.requesterPromptEnabled,
    onRequesterPromptToggle: setRequesterPromptEnabled,
    voiceChatEnabled: roomData.voiceChatEnabled,
    onVoiceChatToggle: setVoiceChatEnabled,
    mcEnabled: roomData.isMCEnabled,
    onMCToggle: setMCEnabled,
    mcVoice: roomData.mcVoice,
    onMcVoiceChange: setMcVoice,
    aiScoringEnabled: roomData.aiScoringEnabled,
    onAiScoringToggle: setAiScoringEnabled,
    isHost,
    guestCanRemove: roomData.guestCanRemove,
    onGuestCanRemoveToggle: setGuestCanRemove,
    onLeave: handleLeave,
  };

  return (
    <main
      className="relative h-[100dvh] w-full flex flex-col overflow-hidden bg-bg text-fg"
      onPointerDown={resetActivity}
    >
      <NoticeBanner notice={notice} />
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
        {/* Search column.
            While loading we apply pt-[var(--header-h)] like the queue
            section does, because the SearchSkeleton has no internal
            absolute-positioning logic to land below the mobile header.
            Once the real SearchPanel mounts it manages its own offset
            (absolute bar + spacer), so the padding is dropped to avoid
            double-counting the header. */}
        <section
          aria-label="Search"
          className={`min-h-0 overflow-hidden lg:block lg:border-r lg:border-border ${
            isLoading ? 'pt-[var(--header-h)] lg:pt-0' : ''
          } ${
            tab === 'search' ? 'h-full' : 'hidden'
          }`}
        >
          {isLoading ? (
            <SearchSkeleton />
          ) : (
            <>
            <div className={effectiveSearchMode === 'manual' ? 'h-full' : 'hidden'}>
            <SearchPanel
              modeSwitch={voiceChatAvailable ? <SearchModeSwitch mode={effectiveSearchMode} onChange={setSearchMode} /> : undefined}
              active={effectiveSearchMode === 'manual' && tab === 'search' && !timedOut}
              onAdd={handleAddToQueue}
              queuedMap={queuedMap}
              queuePositionMap={queuePositionMap}
              currentPlayingId={currentPlayingId}
              headerHeight={effectiveHeaderHeight}
              onChromeChange={handleChromeChange}
              onFocusChange={setIsSearchFocused}
            />
            </div>
            <div className={effectiveSearchMode === 'voice' ? 'h-full' : 'hidden'}>
              <VoiceChatPanel
                conversation={voiceConversation}
                active={effectiveSearchMode === 'voice' && tab === 'search' && !timedOut && !playerOpen}
                modeSwitch={<SearchModeSwitch mode={effectiveSearchMode} onChange={setSearchMode} />}
                currentPlaying={roomData.currentPlaying}
              />
            </div>
            </>
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
            modal in the header instead, so this is `lg:hidden`. Mounting
            is gated on `tab === 'settings'` (not the desktop-modal latch)
            so the panel works whether the user reached this tab by
            tapping BottomNav or by refreshing on `?tab=settings` — the
            URL is the source of truth for the active tab. The dynamic
            import handles chunk-load lazily on first visit. */}
        <section
          aria-label="Settings"
          className={`min-h-0 overflow-y-auto overscroll-contain pt-[var(--header-h)] lg:hidden ${
            tab === 'settings' ? 'h-full' : 'hidden'
          }`}
        >
          {isLoading ? (
            <SettingsSkeleton />
          ) : (
            tab === 'settings' && (
              <SettingsPanel {...settingsProps} panelOpen={tab === 'settings'} />
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
          onClose={closePlayer}
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
          onTabChange={setTab}
        />
      </div>

      {hasOpenedSettings && (
        <SettingsSheet
          {...settingsProps}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
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
