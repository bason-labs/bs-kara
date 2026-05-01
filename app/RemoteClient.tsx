'use client';

import { Suspense, FormEvent, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LogOut, QrCode, Search, ListMusic, Settings } from 'lucide-react';
import { YouTubeVideo } from '@/lib/youtube';
import { useRoom } from '@/hooks/useRoom';
import { useAutoRandom } from '@/hooks/useAutoRandom';
import { primeAudio } from '@/hooks/useAIVoice';
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
  // a pointer is live. Resolved post-mount so SSR and the first client render
  // agree (avoids a hydration mismatch when the server returns false but the
  // device is actually a phone).
  const [isCoarsePointer, setIsCoarsePointer] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
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
    // When we *do* have a room (or aren't on a coarse pointer), reset the
    // ref so a later "end party" → bounce back to `/` triggers a fresh
    // claim instead of stranding mobile on the spinner forever.
    if (rawRoomCode || !isCoarsePointer) {
      autoJoinStartedRef.current = false;
      return;
    }
    if (autoJoinStartedRef.current) return;
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
    if (roomMissing) {
      localStorage.removeItem('karaoke_client_room');
    }
  }, [roomMissing]);

  // Inline toast for transient notices (e.g. "the room you were in has
  // ended"). Lives next to the rest of the home/main UI rather than the
  // not-found panel that used to occupy this space.
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 4000);
  }, []);
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // When the TV ends the party (or the URL points at a stale/bad code), drop
  // back to home and surface a toast so the user understands why. The home
  // screen already surfaces whatever room is currently active, so they can
  // rejoin from there if they want to. Translating a Firebase state
  // transition into UI legitimately requires setState here.
  useEffect(() => {
    if (!roomMissing) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    showNotice(t('errors.roomNotFound.message'));
    router.replace('/');
  }, [roomMissing, router, showNotice, t]);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      showNotice(t('tv.endPartyNotice'));
    }
  }, [roomData.lastEndedAt, showNotice, t]);

  // Reset the seen marker when the room changes so a fresh subscribe
  // re-seeds against the new room's history instead of replaying it.
  useEffect(() => {
    lastEndedSeenRef.current = undefined;
  }, [roomCode]);

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
              volume={roomData.volume}
              hasHistory={roomData.history.length > 0}
              hasQueue={roomData.queue.length > 0}
              currentPlaying={roomData.currentPlaying}
              onTogglePlayPause={() => togglePlayPause(roomData.isPlaying)}
              onVolumeChange={setVolume}
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
