'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { lookupUserByPhone, type RegisteredUser } from '@/lib/registeredUsers';

export interface CurrentHostState {
  user: User | null;
  profile: RegisteredUser | null;
  loading: boolean;
}

export function useCurrentHost(): CurrentHostState {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<RegisteredUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return;
      setUser(u);
      if (u?.phoneNumber) {
        const found = await lookupUserByPhone(u.phoneNumber);
        if (!cancelled) setProfile(found);
      } else {
        setProfile(null);
      }
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { user, profile, loading };
}
