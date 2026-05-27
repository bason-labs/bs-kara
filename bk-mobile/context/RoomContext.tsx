import React, { createContext, useContext } from 'react';
import { useRoom } from '@bs-kara/shared/hooks';
import { useCurrentHost } from '@/hooks/useCurrentHost';

type RoomContextValue = ReturnType<typeof useRoom> & { roomCode: string; isHost: boolean };

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({
  roomCode,
  children,
}: {
  roomCode: string;
  children: React.ReactNode;
}) {
  const room = useRoom(roomCode);
  const { profile, loading } = useCurrentHost();
  const isHost = !loading && profile !== null;
  return <RoomContext.Provider value={{ ...room, roomCode, isHost }}>{children}</RoomContext.Provider>;
}

export function useRoomContext(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoomContext must be used inside RoomProvider');
  return ctx;
}
