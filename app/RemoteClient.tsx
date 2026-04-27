'use client';

import { Suspense, FormEvent, useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LogOut, QrCode, Search, ListMusic } from 'lucide-react';
import { YouTubeVideo } from '@/lib/youtube';
import { useRoom } from '@/hooks/useRoom';
import { SearchPanel } from './components/SearchPanel';
import { ClientQueue } from './components/ClientQueue';
import { RemoteControls } from './components/client/RemoteControls';
import { EmojiPad } from './components/client/EmojiPad';
import { FullscreenPlayer } from './components/FullscreenPlayer';
import { NeonOrbs } from './components/NeonOrbs';
import { NowPlayingCard } from './components/NowPlayingCard';
import { OTPInput } from './components/OTPInput';
import { ThemeToggle } from './components/ThemeToggle';

type Tab = 'search' | 'queue';

function RemoteInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomCode = searchParams.get('room');

  // Auto-redirect to saved room or persist current room in localStorage
  useEffect(() => {
    if (!roomCode) {
      const saved = localStorage.getItem('karaoke_client_room');
      if (saved) {
        router.replace(`/?room=${saved}`);
      }
    } else {
      localStorage.setItem('karaoke_client_room', roomCode);
    }
  }, [roomCode, router]);

  const [inputCode, setInputCode] = useState('');
  const [tab, setTab] = useState<Tab>('search');
  const [playerOpen, setPlayerOpen] = useState(false);
  const {
    roomData,
    isLoading,
    addSongToQueue,
    removeSong,
    reorderQueue,
    togglePlayPause,
    setVolume,
    playNext,
    playPrevious,
    sendEmoji,
  } = useRoom(roomCode);

  const submitJoin = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (trimmed.length !== 4) return;
      router.push(`/?room=${trimmed}`);
    },
    [router],
  );

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    submitJoin(inputCode);
  }

  function handleAddToQueue(video: YouTubeVideo) {
    addSongToQueue(video);
  }

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

          <form
            onSubmit={handleJoin}
            className="w-full flex flex-col items-center gap-6 rounded-3xl border border-border bg-surface/70 backdrop-blur-md p-6 sm:p-8 shadow-glow"
          >
            <label className="w-full text-left text-xs uppercase tracking-[0.25em] text-muted">
              {t('home.roomCodeLabel')}
            </label>

            <OTPInput
              value={inputCode}
              onChange={setInputCode}
              onComplete={submitJoin}
              ariaLabel={t('home.roomCodeLabel')}
            />

            <button
              type="submit"
              disabled={inputCode.length !== 4}
              className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {t('home.joinButton')}
            </button>

            <p className="flex items-center gap-2 text-xs text-muted">
              <QrCode size={14} />
              {t('home.qrTip')}
            </p>
          </form>
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

        <ThemeToggle />
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
                onExpand={() => setPlayerOpen(true)}
              />
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ClientQueue
              items={roomData.queue}
              isLoading={isLoading}
              onReorder={reorderQueue}
              onRemove={removeSong}
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
          onSongEnd={playNext}
          onClose={() => setPlayerOpen(false)}
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
