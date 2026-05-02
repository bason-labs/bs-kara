'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'karaoke_theme';

/* External store: the user's stored preference. Subscribes to `storage`
   events so multi-tab updates stay in sync. */
function subscribePreference(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

function getStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

function getServerPreference(): ThemePreference {
  return 'system';
}

/* External store: OS color scheme. Only consulted when preference === 'system'. */
function subscribeOSScheme(callback: () => void) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getOSScheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getServerOSScheme(): ResolvedTheme {
  return 'dark';
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(
    subscribePreference,
    getStoredPreference,
    getServerPreference,
  );
  const osScheme = useSyncExternalStore(subscribeOSScheme, getOSScheme, getServerOSScheme);

  const resolved: ResolvedTheme = preference === 'system' ? osScheme : preference;

  // Keep the DOM attribute in sync with the resolved theme. Safe: this is
  // updating an external system (the DOM) from React state, which is exactly
  // what an effect is for.
  if (typeof window !== 'undefined') {
    queueMicrotask(() => applyTheme(resolved));
  }

  const setPreference = useCallback((next: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, next);
    // Manually fire a storage event for same-tab listeners (storage events
    // only fire cross-tab natively).
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: next }));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
