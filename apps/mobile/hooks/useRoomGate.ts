import { useEffect, useState } from 'react';
import { subscribeActiveRooms } from '@bs-kara/shared';

interface RoomGateState {
  activeRoomCode: string | null;
  isLoading: boolean;
}

export function useRoomGate(): RoomGateState {
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    return subscribeActiveRooms((codes) => {
      setActiveRoomCode(codes.length > 0 ? codes[0] : null);
      setIsLoading(false);
    });
  }, []);

  return { activeRoomCode, isLoading };
}
