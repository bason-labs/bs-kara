import { useCallback, useEffect, useRef } from 'react';
import { onDisconnect, ref, runTransaction } from 'firebase/database';
import { db, getRoomDataPath } from '@bs-kara/shared';

// Generates a stable per-session device id. Survives re-renders within the
// same app session; a new launch gets a new id (which is what we want for
// fullscreen claims).
//
// Web Crypto's crypto.randomUUID() is not guaranteed on all RN/Hermes targets,
// so we fall back to a timestamp + random suffix which is collision-safe in
// practice for this single-room ownership use case.
function useDeviceId(): string {
  const idRef = useRef<string>('');
  if (!idRef.current) {
    idRef.current =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return idRef.current;
}

export interface UseFullscreenOwnershipReturn {
  deviceId: string;
  claim: () => Promise<boolean>;
  release: () => Promise<void>;
}

export function useFullscreenOwnership(
  roomId: string | null,
): UseFullscreenOwnershipReturn {
  const deviceId = useDeviceId();

  const claim = useCallback(async (): Promise<boolean> => {
    if (!roomId) return false;
    const ownerRef = ref(db, `${getRoomDataPath(roomId)}/fullscreenOwner`);
    // Atomic: only claim if currently null OR already mine. If another device
    // holds the lock, the transaction aborts and we return false.
    const result = await runTransaction(ownerRef, (current) => {
      if (current === null || current === deviceId) return deviceId;
      return; // abort — another device owns the lock
    });
    if (result.committed) {
      // Auto-release on disconnect (network drop, app backgrounded long enough
      // for Firebase to detect the connection loss).
      onDisconnect(ownerRef).set(null);
      return true;
    }
    return false;
  }, [roomId, deviceId]);

  const release = useCallback(async (): Promise<void> => {
    if (!roomId) return;
    const ownerRef = ref(db, `${getRoomDataPath(roomId)}/fullscreenOwner`);
    await runTransaction(ownerRef, (current) => {
      if (current === deviceId) return null;
      return; // not mine, don't touch
    });
  }, [roomId, deviceId]);

  // Cleanup: if this hook unmounts while we still hold the lock, release it.
  useEffect(() => {
    return () => {
      void release();
    };
  }, [release]);

  return { deviceId, claim, release };
}
