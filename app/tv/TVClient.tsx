'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Music } from 'lucide-react';
import { useRoom } from '@/hooks/useRoom';
import { VideoPlayer } from '../components/host/VideoPlayer';
import { EmojiLayer } from '../components/host/EmojiLayer';

export default function TVClient() {
  const { t } = useTranslation();
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const fixed = process.env.NEXT_PUBLIC_FIXED_ROOM_ID;
    let id: string;
    if (fixed) {
      id = fixed;
    } else {
      const saved = localStorage.getItem('karaoke_tv_room');
      id = saved ?? String(Math.floor(1000 + Math.random() * 9000));
    }
    localStorage.setItem('karaoke_tv_room', id);
    setRoomCode(id);
  }, []);

  const { roomData, isLoading, playNext, clearRoom } = useRoom(roomCode);

  const handleSongEnd = useCallback(() => {
    playNext();
  }, [playNext]);

  const handleEndParty = useCallback(async () => {
    await clearRoom();
    localStorage.removeItem('karaoke_tv_room');
    const newCode = String(Math.floor(1000 + Math.random() * 9000));
    localStorage.setItem('karaoke_tv_room', newCode);
    setRoomCode(newCode);
  }, [clearRoom]);

  const initialize = useCallback(() => setIsInitialized(true), []);

  // Global keydown listener for TV remote / keyboard interaction
  useEffect(() => {
    if (isInitialized) return;
    window.addEventListener('keydown', initialize);
    return () => window.removeEventListener('keydown', initialize);
  }, [isInitialized, initialize]);

  // Auto-promote the first queued song when nothing is playing
  useEffect(() => {
    if (!isInitialized) return;
    if (!roomData.currentPlaying && roomData.queue.length > 0) {
      playNext();
    }
  }, [isInitialized, roomData.currentPlaying, roomData.queue.length, playNext]);

  const bgImageUrl = roomData.currentPlaying?.id
    ? `https://img.youtube.com/vi/${roomData.currentPlaying.id}/maxresdefault.jpg`
    : '';

  return (
    <main className="relative h-[100dvh] w-full flex overflow-hidden bg-black text-white">
      {/* Ambient glow background layers */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-110 blur-[100px] opacity-60 transition-all duration-1000"
          style={{ backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : 'none' }}
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Waiting Room overlay — fades out on first interaction */}
      <section
        aria-label="Waiting room"
        onClick={initialize}
        className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 text-white transition-opacity duration-700 ${
          isInitialized ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <h1 className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-4">{t('tv.heading')}</h1>
        <p className="text-2xl font-semibold text-gray-300 mb-2">{t('tv.roomLabel')}</p>
        <div className="text-8xl font-black tracking-[0.25em] tabular-nums mb-10">
          {roomCode ?? '----'}
        </div>

        {/* QR placeholder */}
        <div className="w-36 h-36 bg-white rounded-2xl flex items-center justify-center mb-10">
          <div className="text-center">
            <div className="text-gray-400 text-xs font-medium leading-tight whitespace-pre-line">{t('tv.qrHint')}</div>
          </div>
        </div>

        <p className="text-gray-500 text-sm animate-pulse">
          {t('tv.startPrompt')}
        </p>
      </section>

      {roomCode && <EmojiLayer roomId={roomCode} />}
      {/* Left: Video Player */}
      <section aria-label="Now playing" className="relative z-10 flex-1 min-w-0 overflow-hidden">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-4 border-gray-700 border-t-gray-400 animate-spin" />
          </div>
        ) : roomData.currentPlaying ? (
          <VideoPlayer
            videoId={roomData.currentPlaying.id}
            onSongEnd={handleSongEnd}
            isPlaying={roomData.isPlaying}
            volume={roomData.volume}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-gray-600">
            <Music size={64} color="#4b5563" />
            <p className="text-lg">{t('tv.waitingMessage')}</p>
            <p className="text-sm text-gray-700">{t('tv.addSongsHint')}</p>
          </div>
        )}
      </section>

      {/* Right: Queue Panel */}
      <aside aria-label="Queue" className="relative z-10 w-72 flex flex-col bg-gray-900/80 border-l border-gray-700 shrink-0">
        {/* Room code */}
        <div className="p-5 border-b border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">{t('tv.roomCodeLabel')}</p>
          <div className="text-5xl font-bold tracking-[0.2em] tabular-nums">
            {roomCode ?? '----'}
          </div>
          <p className="mt-2 text-xs text-gray-500">{t('tv.roomCodeHint')}</p>
        </div>

        {/* QR placeholder */}
        <div className="p-4 border-b border-gray-700">
          <div className="aspect-square bg-gray-800 rounded-xl flex items-center justify-center text-gray-500 text-sm">
            {t('tv.qrLabel')}
          </div>
        </div>

        {/* Queue */}
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-3">
            {t('tv.queueLabel')}
            {roomData.queue.length > 0 && (
              <span className="ml-1.5 text-gray-600 normal-case tracking-normal">
                ({roomData.queue.length})
              </span>
            )}
          </h2>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-2 items-center animate-pulse">
                  <div className="w-4 h-3 bg-gray-700 rounded shrink-0" />
                  <div className="w-14 h-8 bg-gray-700 rounded shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-gray-700 rounded w-full" />
                    <div className="h-2.5 bg-gray-700 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : roomData.queue.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-8">{t('tv.emptyQueueMessage')}</p>
          ) : (
            <ul className="space-y-2">
              {roomData.queue.map((item, i) => (
                <li key={item.queueId} className="flex gap-2 items-center">
                  <span className="text-xs text-gray-600 w-4 shrink-0 text-right">{i + 1}</span>
                  <div className="relative w-14 h-8 shrink-0 rounded overflow-hidden bg-gray-800">
                    <Image
                      src={item.thumbnail}
                      alt={item.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-200 line-clamp-2 leading-tight">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{item.channel}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* End Party */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleEndParty}
            className="w-full py-2 text-xs text-gray-600 hover:text-red-400 hover:border-red-800 border border-gray-800 rounded-lg transition-colors"
          >
            {t('tv.endPartyButton')}
          </button>
        </div>
      </aside>
    </main>
  );
}
