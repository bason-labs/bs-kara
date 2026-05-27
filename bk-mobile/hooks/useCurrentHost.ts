import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@bs-kara/shared';
import { lookupUserByPhone, type RegisteredUser } from '@/lib/registeredUsers';

export interface CurrentHostState {
  user: User | null;
  profile: RegisteredUser | null;
  loading: boolean;
}

const CACHE_KEY = 'bs_kara_host_profile';

async function readCache(): Promise<RegisteredUser | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as RegisteredUser) : null;
  } catch {
    return null;
  }
}

async function writeCache(p: RegisteredUser | null): Promise<void> {
  try {
    if (p) await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(p));
    else await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // storage unavailable, ignore
  }
}

export function useCurrentHost(): CurrentHostState {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<RegisteredUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load cached profile first to avoid skeleton flash
    readCache().then((cached) => {
      if (cached) setProfile(cached);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return;
      setUser(u);
      if (u?.phoneNumber) {
        const found = await lookupUserByPhone(u.phoneNumber);
        if (!cancelled) {
          setProfile(found);
          void writeCache(found);
        }
      } else {
        setProfile(null);
        void writeCache(null);
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
