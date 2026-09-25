'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@bs-kara/shared';
import { lookupUserByPhone, type RegisteredUser } from '@/lib/registeredUsers';

export interface CurrentHostState {
  user: User | null;
  profile: RegisteredUser | null;
  loading: boolean;
}

const CACHE_KEY = 'bs_kara_host_profile';

function readCache(): RegisteredUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as RegisteredUser) : null;
  } catch {
    return null;
  }
}

function writeCache(p: RegisteredUser | null) {
  try {
    if (p) localStorage.setItem(CACHE_KEY, JSON.stringify(p));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // storage unavailable, ignore
  }
}

export function useCurrentHost(): CurrentHostState {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<RegisteredUser | null>(() => readCache());
  // Skip the loading skeleton when a cached profile is available; Firebase
  // will still correct stale data in the background.
  const [loading, setLoading] = useState<boolean>(() => readCache() === null);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return;
      setUser(u);
      if (u?.phoneNumber) {
        const found = await lookupUserByPhone(u.phoneNumber);
        if (!cancelled) {
          setProfile(found);
          writeCache(found);
        }
      } else {
        setProfile(null);
        writeCache(null);
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
