'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { LogOut, Search, ListMusic, Settings } from 'lucide-react';
import { useRoom } from '@/hooks/useRoom';
import { useAutoRandom } from '@/hooks/useAutoRandom';
import { useTransientNotice } from '@/hooks/useTransientNotice';
import { primeAudio } from '@/hooks/useAIVoice';
import { SearchPanel } from '@/features/remote/components/SearchPanel';
import { ClientQueue } from '@/features/remote/components/ClientQueue';
import { RemoteControls } from '@/features/remote/components/RemoteControls';
import { EmojiPad } from '@/features/remote/components/EmojiPad';
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

type Tab = 'search' | 'queue';

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
    forgetSavedRoom,
  } = useRoomGate();

  const [tab, setTab] = useState<Tab>('search');
  const [playerOpen, setPlayerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    setMcVoice,
    tryClaimAnnouncementLock,
    removeCurrentPlaying,
    addToPlayedHistory,
    setCurrentPlayingDirectly,
  } = useRoom(roomCode);

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

  // If we're showing the not-found panel, forget any saved code so leaving
  // via "Về trang chủ" actually lands on home (and doesn't immediately
  // restore the bad code from localStorage).
  useEffect(() => {
    if (roomMissing) forgetSavedRoom();
  }, [roomMissing, forgetSavedRoom]);

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

  const queuedMap = useQueuedMap(roomData.queue);
  const currentPlayingId = roomData.currentPlaying?.id ?? null;

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
            <div className="w-full h-[260px] rounded-3xl border border-border bg-surface/70 backdrop-blur-md shadow-glow" />
          ) : isCoarsePointer ? (
            <div className="w-full flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface/70 backdrop-blur-md p-8 shadow-glow">
              <div className="w-10 h-10 rounded-full border-4 border-border border-t-transparent animate-spin" />
              <p className="text-sm text-muted">{t('home.startingRoom')}</p>
            </div>
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
  ];

  return (
    <main className="h-[100dvh] w-full flex flex-col overflow-hidden bg-bg text-fg">
      {noticeBanner}
      <h1 className="sr-only">{t('home.appHeading')}</h1>

      <header className="flex items-center justify-between px-4 py-3 bg-surface/70 backdrop-blur-md border-b border-border shrink-0">
        <button
          onClick={handleLeave}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-danger transition-colors"
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
      <div className="flex-1 min-h-0 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_460px] xl:grid-cols-[minmax(0,1fr)_500px]">
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
            queuedMap={queuedMap}
            currentPlayingId={currentPlayingId}
            isQueueLoading={isLoading}
          />
        </section>

        {/* Queue column — queue + reactions + transport controls stacked */}
        <section
          aria-label="Queue and controls"
          className={`min-h-0 flex flex-col overflow-hidden lg:flex lg:bg-surface/40 ${
            tab === 'queue' ? 'flex h-full' : 'hidden'
          }`}
        >
          {/* When the TV is showing the song, hide the duplicate card on
              mobile but keep transport controls so the phone is still a
              remote. */}
          {roomData.currentPlaying && !roomData.isTvActive && (
            <div className="px-3 pt-3 pb-1">
              <NowPlayingCard
                track={roomData.currentPlaying}
                isPlaying={roomData.isPlaying}
                onExpand={() => {
                  // requestFullscreen must run synchronously inside the user
                  // gesture; deferring to the FullscreenPlayer's mount effect
                  // loses the activation token in some browsers.
                  // primeAudio() also runs inside the gesture so the MC
                  // announcement (which fires from an async useEffect after
                  // the player mounts) can actually produce audio on iOS
                  // Safari and mobile Chrome.
                  primeAudio();
                  document.documentElement.requestFullscreen?.().catch(() => {});
                  setPlayerOpen(true);
                }}
                onRemove={removeCurrentPlaying}
              />
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ClientQueue
              items={roomData.queue}
              isLoading={isLoading}
              onReorder={reorderQueue}
              onRemove={removeSong}
              onEditRequester={
                roomData.requesterPromptEnabled ? handleEditRequester : undefined
              }
              dragDropEnabled={roomData.dragDropEnabled}
            />
          </div>
          <div className="shrink-0 bg-surface/85 backdrop-blur-md border-t border-border">
            <EmojiPad onSendEmoji={sendEmoji} />
            <RemoteControls
              isPlaying={roomData.isPlaying}
              hasHistory={roomData.history.length > 0}
              hasQueue={roomData.queue.length > 0}
              currentPlaying={roomData.currentPlaying}
              onTogglePlayPause={() => togglePlayPause(roomData.isPlaying)}
              onPrev={playPrevious}
              onNext={playNext}
            />
          </div>
        </section>
      </div>

      {playerOpen && roomData.currentPlaying && (
        <FullscreenPlayer
          track={roomData.currentPlaying}
          roomId={roomCode}
          isPlaying={roomData.isPlaying}
          volume={roomData.volume}
          hasHistory={roomData.history.length > 0}
          hasQueue={roomData.queue.length > 0}
          isMCEnabled={roomData.isMCEnabled}
          mcVoice={roomData.mcVoice}
          // Only consult the cross-device lock when the TV is actually
          // racing us. Without this, a stale lastAnnouncedSongId from a
          // prior session makes the claim fail and the gate releases
          // immediately — the video plays without an announcement.
          tryClaimAnnouncementLock={
            roomData.isTvActive ? tryClaimAnnouncementLock : undefined
          }
          onSongEnd={playNext}
          onClose={() => setPlayerOpen(false)}
          onPrev={playPrevious}
          onNext={playNext}
          onPlayingChange={setIsPlaying}
        />
      )}

      {/* Mobile bottom tab bar */}
      <nav
        role="tablist"
        aria-label="Sections"
        className="lg:hidden shrink-0 grid grid-cols-2 bg-surface/85 backdrop-blur-md border-t border-border"
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
