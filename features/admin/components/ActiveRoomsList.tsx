'use client';

import { useEffect, useState } from 'react';
import { subscribeActiveRooms, deactivateRoom } from '@/lib/activeRoom';
import { resetRoom } from '@/lib/resetRoom';
import { type RegisteredUser } from '@/lib/registeredUsers';

interface ActiveRoomsListProps {
  users: RegisteredUser[];
  onRefresh: () => void;
}

export function ActiveRoomsList({ users, onRefresh }: ActiveRoomsListProps) {
  const [activeCodes, setActiveCodes] = useState<string[]>([]);
  const [ending, setEnding] = useState<string | null>(null);

  useEffect(() => {
    return subscribeActiveRooms(setActiveCodes);
  }, []);

  async function handleForceEnd(code: string) {
    if (!confirm(`Kết thúc phòng ${code}?`)) return;
    setEnding(code);
    try {
      await resetRoom(code);
      await deactivateRoom(code);
      onRefresh();
    } finally {
      setEnding(null);
    }
  }

  if (activeCodes.length === 0) {
    return <p className="text-muted text-sm">Không có phòng nào đang hoạt động.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {activeCodes.map((code) => {
        const owner = users.find((u) => u.roomCode === code);
        return (
          <div
            key={code}
            className="flex items-center justify-between px-4 py-3 rounded-2xl border border-border bg-surface"
          >
            <div>
              <span className="font-mono font-bold">{code}</span>
              {owner && (
                <span className="ml-3 text-sm text-muted">
                  {owner.displayName ?? owner.normalizedPhone}
                </span>
              )}
            </div>
            <button
              onClick={() => handleForceEnd(code)}
              disabled={ending === code}
              className="text-xs px-3 py-1 rounded-full border border-danger/40 text-danger hover:bg-danger/10 disabled:opacity-40 transition-colors"
            >
              {ending === code ? 'Đang kết thúc...' : 'Kết thúc'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
