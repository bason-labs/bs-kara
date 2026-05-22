import React, { createContext, useContext } from 'react';
import { useRoom } from '@bs-kara/shared/hooks';

type RoomContextValue = ReturnType<typeof useRoom> & { roomCode: string };

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({
  roomCode,
  children,
}: {
  roomCode: string;
  children: React.ReactNode;
}) {
  const room = useRoom(roomCode);
  return <RoomContext.Provider value={{ ...room, roomCode }}>{children}</RoomContext.Provider>;
}

export function useRoomContext(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoomContext must be used inside RoomProvider');
  return ctx;
}
