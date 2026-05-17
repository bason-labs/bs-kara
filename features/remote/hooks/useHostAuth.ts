'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export interface HostAuthState {
  user: User | null;
  isHost: boolean;
  loading: boolean;
}

export function useHostAuth(hostUid: string | null): HostAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const isHost = !!user && !!hostUid && user.uid === hostUid;
  return { user, isHost, loading };
}
