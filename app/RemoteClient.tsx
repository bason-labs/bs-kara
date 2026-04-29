'use client';

import { Suspense, FormEvent, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LogOut, QrCode, Search, ListMusic, DoorClosed, Settings } from 'lucide-react';
import { YouTubeVideo } from '@/lib/youtube';
import { useRoom } from '@/hooks/useRoom';
import { useAutoRandom } from '@/hooks/useAutoRandom';
import { claimOrGetActiveRoom, subscribeActiveRoom } from '@/lib/activeRoom';
import { SearchPanel } from './components/SearchPanel';
import { ClientQueue } from './components/ClientQueue';
import { RemoteControls } from './components/client/RemoteControls';
import { EmojiPad } from './components/client/EmojiPad';
import { SettingsSheet } from './components/client/SettingsSheet';
import { NowPlayingCard } from './components/NowPlayingCard';
import { FullscreenPlayer } from './components/FullscreenPlayer';
import { NeonOrbs } from './components/NeonOrbs';
import { OTPInput } from './components/OTPInput';
import { ThemeToggle } from './components/ThemeToggle';
import { AddedToast } from './components/AddedToast';
import { RequesterDialog } from './components/RequesterDialog';

const LAST_SINGER_KEY = 'lastSingerName';

type Tab = 'search' | 'queue';

const ROOM_CODE_PATTERN = /^\d{4}$/;

function RemoteInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawRoomCode = searchParams.get('room');
  // The OTP form gates manual entry, but the `?room=` query param bypasses
  // it. Anything that isn't a 4-digit code is treated as no room (and the
  // URL is cleaned up in the effect below) so we don't subscribe to a
  // garbage Firebase path or render the shell with bogus data.
  const roomCode = rawRoomCode && ROOM_CODE_PATTERN.test(rawRoomCode)
    ? rawRoomCode
    : null;

  // Persist the current room code so a fresh tab can restore it on first
  // load. Runs whenever the URL settles on a valid room.
  useEffect(() => {
    if (roomCode) {
      localStorage.setItem('karaoke_client_room', roomCode);
    }
  }, [roomCode]);

  // Restore the last valid saved code only on the initial mount with a bare
  // `/` URL. Doing this on every navigation to `/` would trap the user: once
  // they Back out of a room, the effect would immediately redirect them
  // straight back into it.
  const restoreCheckedRef = useRef(false);
  useEffect(() => {
    if (restoreCheckedRef.current) return;
    restoreCheckedRef.current = true;
    if (rawRoomCode) return;
    const saved = localStorage.getItem('karaoke_client_room');
    if (saved && ROOM_CODE_PATTERN.test(saved)) {
      router.replace(`/?room=${saved}`);
    } else if (saved) {
      // Clear garbage that may have been persisted before validation existed.
      localStorage.removeItem('karaoke_client_room');
    }
  }, [rawRoomCode, router]);

  // Mobile devices skip the OTP form entirely: they auto-join whichever room
  // the TV (or a previous phone) has already claimed, or claim a new one if
  // nobody has yet. Desktops keep the OTP form but get a shortcut button when
  // a pointer is live.
  const isCoarsePointer = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  }, []);

  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [pointerLoaded, setPointerLoaded] = useState(false);
  const autoJoinStartedRef = useRef(false);

  // Always subscribe — the not-found panel also needs to know whether
  // there's an active room so it can offer a "join the open party" shortcut.
  useEffect(() => {
    return subscribeActiveRoom((code) => {
      setActiveRoom(code);
      setPointerLoaded(true);
    });
  }, []);

  useEffect(() => {
    // Gate on rawRoomCode so a malformed `?room=` value still keeps us on
    // the not-found panel instead of silently auto-joining the active room.
    if (rawRoomCode || !isCoarsePointer || autoJoinStartedRef.current) return;
    autoJoinStartedRef.current = true;
    let cancelled = false;
    (async () => {
      const code = await claimOrGetActiveRoom();
      if (cancelled) return;
      router.replace(`/?room=${code}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [rawRoomCode, isCoarsePointer, router]);

  const [inputCode, setInputCode] = useState('');
  const [tab, setTab] = useState<Tab>('search');
  const [playerOpen, setPlayerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    setVolume,
    playNext,
    playPrevious,
    sendEmoji,
    setAutoRandomMode,
    setRandomFilters,
    setDragDropEnabled,
    setRequesterPromptEnabled,
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
    if (roomMissing) {
      localStorage.removeItem('karaoke_client_room');
    }
  }, [roomMissing]);

  // Joining is gated by the active-room pointer: a code is only accepted if
  // it matches the room currently in `meta/activeRoom`. This prevents users
  // from typing a random 4-digit code and silently landing in an empty,
  // never-created room.
  const submitJoin = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (trimmed.length !== 4) return;
      if (!activeRoom || trimmed !== activeRoom) return;
      router.push(`/?room=${trimmed}`);
    },
    [router, activeRoom],
  );

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    submitJoin(inputCode);
  }

  const codeMismatch =
    pointerLoaded && inputCode.length === 4 && inputCode !== activeRoom;
  const canSubmitCode =
    !!activeRoom && inputCode.length === 4 && inputCode === activeRoom;

  const [toastSong, setToastSong] = useState<YouTubeVideo | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Pending video while the requester dialog is open. Capturing the target
  // here means the dialog stays decoupled from the search panel — the panel
  // just fires `onAdd(video)` like before.
  const [pendingAdd, setPendingAdd] = useState<YouTubeVideo | null>(null);
  // Edit mode keys off a queue item; null when we're in add mode.
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [dialogInitialName, setDialogInitialName] = useState('');

  function rememberSinger(name: string) {
    try {
      localStorage.setItem(LAST_SINGER_KEY, name);
    } catch {}
  }

  function handleAddToQueue(video: YouTubeVideo) {
    // Honor the room-wide setting: when the prompt is off, skip the dialog
    // and add the song straight to the queue (no requester attached). The
    // toast still fires so the user gets feedback.
    if (!roomData.requesterPromptEnabled) {
      addSongToQueue(video);
      setToastSong(video);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastSong(null), 2500);
      return;
    }
    setPendingAdd(video);
    setEditingQueueId(null);
    // Each "Add" opens with an empty input — multiple users share one device,
    // so prefilling with the previous singer would make them backspace every
    // time. Edit mode still shows the song's current requester (below).
    setDialogInitialName('');
  }

  function handleEditRequester(item: { queueId: string; requesterName?: string }) {
    setPendingAdd(null);
    setEditingQueueId(item.queueId);
    setDialogInitialName(item.requesterName ?? '');
  }

  function closeRequesterDialog() {
    setPendingAdd(null);
    setEditingQueueId(null);
  }

  function handleRequesterConfirm(name: string | null) {
    if (pendingAdd) {
      const video = pendingAdd;
      addSongToQueue(video, name);
      if (name) rememberSinger(name);
      setToastSong(video);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastSong(null), 2500);
    } else if (editingQueueId) {
      updateRequesterName(editingQueueId, name);
      if (name) rememberSinger(name);
    }
    closeRequesterDialog();
  }

  const requesterDialogOpen = pendingAdd !== null || editingQueueId !== null;
  const requesterDialogMode: 'add' | 'edit' = pendingAdd ? 'add' : 'edit';
  // Tying the key to the current target remounts the dialog each time we open
  // it for a different song. Guarantees stale local state (a half-typed name
  // from a previous open) can't survive into the next session.
  const requesterDialogKey = pendingAdd
    ? `add-${pendingAdd.id}`
    : editingQueueId
      ? `edit-${editingQueueId}`
      : 'closed';

  // videoId → queueId for songs currently waiting in the queue. Used by
  // SearchPanel to toggle the "+ Add" / "Added" button into a remove action.
  // currentPlaying is tracked separately because you can't "un-add" the
  // song that's playing.
  const queuedMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of roomData.queue) {
      if (!map.has(q.id)) map.set(q.id, q.queueId);
    }
    return map;
  }, [roomData.queue]);

  const currentPlayingId = roomData.currentPlaying?.id ?? null;

  function handleLeave() {
    localStorage.removeItem('karaoke_client_room');
    router.push('/');
  }

  if (roomMissing) {
    // Render the panel immediately — gating on pointerLoaded used to avoid a
    // button flash, but it can leave the user stranded on a spinner forever
    // if the Firebase listener never settles (e.g. coming back here via
    // browser history). The "Join active room" button just stays hidden
    // until activeRoom resolves.
    const canJoinActive = !!activeRoom && activeRoom !== roomCode;
    return (
      <main className="relative min-h-[100dvh] w-full flex items-center justify-center px-6 py-10 bg-bg text-fg">
        <div className="w-full max-w-sm rounded-2xl border border-glow/40 bg-surface-2 p-8 shadow-glow text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface text-glow">
            <DoorClosed size={28} aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-fg">
            {t('errors.roomNotFound.title')}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {t('errors.roomNotFound.message')}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {canJoinActive && (
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('karaoke_client_room', activeRoom);
                  router.push(`/?room=${activeRoom}`);
                }}
                className="w-full py-3 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98]"
              >
                {t('home.joinActiveRoom', { code: activeRoom })}
              </button>
            )}
            <Link
              href="/"
              onClick={() => {
                localStorage.removeItem('karaoke_client_room');
              }}
              className={`inline-block w-full py-3 rounded-full font-semibold tracking-wide transition-transform active:scale-[0.98] ${
                canJoinActive
                  ? 'border border-border text-fg hover:bg-surface'
                  : 'bg-gradient-brand text-white shadow-glow'
              }`}
            >
              {t('errors.roomNotFound.cta')}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!roomCode) {
    return (
      <main className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center px-6 py-10 overflow-hidden bg-bg text-fg">
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

          {isCoarsePointer ? (
            <div className="w-full flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface/70 backdrop-blur-md p-8 shadow-glow">
              <div className="w-10 h-10 rounded-full border-4 border-border border-t-transparent animate-spin" />
              <p className="text-sm text-muted">{t('home.startingRoom')}</p>
            </div>
          ) : (
            <form
              onSubmit={handleJoin}
              className="w-full flex flex-col items-center gap-6 rounded-3xl border border-border bg-surface/70 backdrop-blur-md p-6 sm:p-8 shadow-glow"
            >
              {activeRoom && (
                <button
                  type="button"
                  onClick={() => submitJoin(activeRoom)}
                  className="w-full py-3 rounded-full border border-border bg-bg/40 text-sm font-medium tracking-wide text-fg hover:bg-bg/60 transition-colors"
                >
                  {t('home.joinActiveRoom', { code: activeRoom })}
                </button>
              )}

              <label className="w-full text-left text-xs uppercase tracking-[0.25em] text-muted">
                {t('home.roomCodeLabel')}
              </label>

              <OTPInput
                value={inputCode}
                onChange={setInputCode}
                onComplete={submitJoin}
                ariaLabel={t('home.roomCodeLabel')}
                disabled={pointerLoaded && !activeRoom}
              />

              {pointerLoaded && !activeRoom ? (
                <p className="text-xs text-muted text-center leading-relaxed">
                  {t('home.noActiveRoom')}
                </p>
              ) : codeMismatch ? (
                <p className="text-xs text-danger text-center">
                  {t('home.invalidCode')}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={!canSubmitCode}
                className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {t('home.joinButton')}
              </button>

              <p className="flex items-center gap-2 text-xs text-muted">
                <QrCode size={14} />
                {t('home.qrTip')}
              </p>
            </form>
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
          onClick={() => setSettingsOpen(true)}
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
      <div className="flex-1 min-h-0 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
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
          className={`min-h-0 flex flex-col overflow-hidden lg:flex ${
            tab === 'queue' ? 'flex h-full' : 'hidden'
          }`}
        >
          {roomData.currentPlaying && (
            <div className="p-3">
              <NowPlayingCard
                track={roomData.currentPlaying}
                isPlaying={roomData.isPlaying}
                onExpand={() => {
                  // requestFullscreen must run synchronously inside the user
                  // gesture; deferring to the FullscreenPlayer's mount effect
                  // loses the activation token in some browsers.
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
          <EmojiPad onSendEmoji={sendEmoji} />
          <RemoteControls
            isPlaying={roomData.isPlaying}
            volume={roomData.volume}
            hasHistory={roomData.history.length > 0}
            hasQueue={roomData.queue.length > 0}
            currentPlaying={roomData.currentPlaying}
            onTogglePlayPause={() => togglePlayPause(roomData.isPlaying)}
            onVolumeChange={setVolume}
            onPrev={playPrevious}
            onNext={playNext}
          />
        </section>
      </div>

      {playerOpen && roomData.currentPlaying && (
        <FullscreenPlayer
          track={roomData.currentPlaying}
          isPlaying={roomData.isPlaying}
          volume={roomData.volume}
          hasHistory={roomData.history.length > 0}
          hasQueue={roomData.queue.length > 0}
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
      />

      <RequesterDialog
        key={requesterDialogKey}
        open={requesterDialogOpen}
        initialName={dialogInitialName}
        mode={requesterDialogMode}
        onConfirm={handleRequesterConfirm}
        onCancel={closeRequesterDialog}
      />

      <AddedToast
        song={toastSong}
        onViewQueue={() => {
          setTab('queue');
          setToastSong(null);
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        }}
        onDismiss={() => {
          setToastSong(null);
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        }}
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
