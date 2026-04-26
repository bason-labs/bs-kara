'use client';

import { useState, useEffect } from 'react';

export default function TVPage() {
  const [roomCode, setRoomCode] = useState<string | null>(null);

  useEffect(() => {
    setRoomCode(String(Math.floor(1000 + Math.random() * 9000)));
  }, []);

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-black text-white">
      <p className="text-lg text-gray-400 mb-4 tracking-widest uppercase">
        Room Code
      </p>
      <div className="text-8xl font-bold tracking-[0.2em] tabular-nums">
        {roomCode ?? '----'}
      </div>
      <p className="mt-6 text-sm text-gray-500">
        Enter this code on your phone to join
      </p>
    </div>
  );
}
