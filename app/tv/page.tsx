'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRoom } from '@/hooks/useRoom';
import { VideoPlayer } from '../components/host/VideoPlayer';

export default function TVPage() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setRoomCode(String(Math.floor(1000 + Math.random() * 9000)));
  }, []);

  const { roomData, playNext } = useRoom(roomCode);

  const handleSongEnd = useCallback(() => {
    playNext();
  }, [playNext]);

  // Auto-promote the first queued song when nothing is playing
  useEffect(() => {
    if (!isInitialized) return;
    if (!roomData.currentPlaying && roomData.queue.length > 0) {
      playNext();
    }
  }, [isInitialized, roomData.currentPlaying, roomData.queue.length, playNext]);

  if (!isInitialized) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-black">
        <button
          onClick={() => setIsInitialized(true)}
          className="px-12 py-6 text-2xl font-bold text-black bg-white rounded-2xl hover:bg-gray-100 active:scale-95 transition-all"
        >
          Click to Start Party
        </button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex overflow-hidden bg-black text-white">
      {/* Left: Video Player */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {roomData.currentPlaying ? (
          <VideoPlayer
            videoId={roomData.currentPlaying.id}
            onSongEnd={handleSongEnd}
            isPlaying={true}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-gray-600">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-lg">Waiting for songs&hellip;</p>
            <p className="text-sm text-gray-700">Add songs from your phone using room code below</p>
          </div>
        )}
      </div>

      {/* Right: Queue Panel */}
      <div className="w-72 flex flex-col bg-gray-900 border-l border-gray-700 shrink-0">
        {/* Room code */}
        <div className="p-5 border-b border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Room Code</p>
          <div className="text-5xl font-bold tracking-[0.2em] tabular-nums">
            {roomCode ?? '----'}
          </div>
          <p className="mt-2 text-xs text-gray-500">Enter on your phone to join</p>
        </div>

        {/* QR placeholder */}
        <div className="p-4 border-b border-gray-700">
          <div className="aspect-square bg-gray-800 rounded-xl flex items-center justify-center text-gray-500 text-sm">
            QR Code
          </div>
        </div>

        {/* Queue */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">
            Up Next
            {roomData.queue.length > 0 && (
              <span className="ml-1.5 text-gray-600 normal-case tracking-normal">
                ({roomData.queue.length})
              </span>
            )}
          </p>

          {roomData.queue.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-8">Queue is empty</p>
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
      </div>
    </div>
  );
}
