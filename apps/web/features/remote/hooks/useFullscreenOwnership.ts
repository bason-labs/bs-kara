'use client';

import { useCallback, useEffect, useState } from 'react';
import { onDisconnect, ref, runTransaction } from 'firebase/database';
import { db } from '@bs-kara/shared';
import { getRoomDataPath } from '@bs-kara/shared';

// Generates a stable per-tab device id. Survives re-renders within the same
// tab; a new tab gets a new id (which is what we want for fullscreen claims).
// The id is produced by a lazy useState initializer, which runs exactly once
// off the render path — the React-blessed home for impure init (Date.now /
// Math.random / crypto.randomUUID).
function useDeviceId(): string {
  const [deviceId] = useState<string>(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  return deviceId;
}

export function useFullscreenOwnership(roomId: string | null) {
  const deviceId = useDeviceId();

  const claim = useCallback(async (): Promise<boolean> => {
    if (!roomId) return false;
    const ownerRef = ref(db, `${getRoomDataPath(roomId)}/fullscreenOwner`);
    // Atomic: only claim if currently null OR already mine. If another phone
    // owns it, return false so caller can show "blocked" UI.
    const result = await runTransaction(ownerRef, (current) => {
      if (current === null || current === deviceId) return deviceId;
      return; // abort
    });
    if (result.committed) {
      // Auto-release on disconnect (tab close, network drop, app backgrounded
      // long enough for Firebase to detect).
      onDisconnect(ownerRef).set(null);
      return true;
    }
    return false;
  }, [roomId, deviceId]);

  const release = useCallback(async () => {
    if (!roomId) return;
    const ownerRef = ref(db, `${getRoomDataPath(roomId)}/fullscreenOwner`);
    await runTransaction(ownerRef, (current) => {
      if (current === deviceId) return null;
      return; // not mine, don't touch
    });
  }, [roomId, deviceId]);

  // Cleanup: if this hook unmounts while we still hold the lock, release.
  useEffect(() => {
    return () => {
      void release();
    };
  }, [release]);

  return { deviceId, claim, release };
}
