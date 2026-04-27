'use client';

import { Suspense, FormEvent, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { YouTubeVideo } from '@/lib/youtube';
import { useRoom } from '@/hooks/useRoom';
import { SearchPanel } from './components/SearchPanel';
import { ClientQueue } from './components/ClientQueue';
import { RemoteControls } from './components/client/RemoteControls';
import { EmojiPad } from './components/client/EmojiPad';

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
  const {
    roomData,
    isLoading,
    addSongToQueue,
    reorderQueue,
    togglePlayPause,
    setVolume,
    playNext,
    playPrevious,
    sendEmoji,
  } = useRoom(roomCode);

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    const code = inputCode.trim();
    if (code.length !== 4) return;
    router.push(`/?room=${code}`);
  }

  function handleAddToQueue(video: YouTubeVideo) {
    addSongToQueue(video);
  }

  function handleLeave() {
    localStorage.removeItem('karaoke_client_room');
    router.push('/');
  }

  if (!roomCode) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-white px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('home.title')}</h1>
        <p className="text-sm text-gray-500 mb-8">{t('home.subtitle')}</p>
        <form onSubmit={handleJoin} className="flex flex-col gap-4 w-full max-w-xs">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
            placeholder={t('home.roomCodePlaceholder')}
            className="w-full px-4 py-3 text-center text-3xl font-bold tracking-[0.4em] border-2 border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={inputCode.length !== 4}
            className="w-full py-3 text-base font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('home.joinButton')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-white">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button
          onClick={handleLeave}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors"
        >
          <LogOut size={16} />
          {t('header.leaveButton')}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{t('header.roomLabel')}</span>
          <span className="px-2.5 py-1 text-sm font-bold text-indigo-700 bg-indigo-50 rounded-lg tracking-widest">
            {roomCode}
          </span>
        </div>

        <div className="w-14" />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <SearchPanel onAdd={handleAddToQueue} />
        </div>
        <div className="w-1/3 flex flex-col bg-gray-50 border-l border-gray-200 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <ClientQueue items={roomData.queue} isLoading={isLoading} onReorder={reorderQueue} />
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
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <RemoteInner />
    </Suspense>
  );
}
