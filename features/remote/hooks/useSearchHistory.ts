'use client';

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'searchHistory';
const MAX_ENTRIES = 15;

export type SearchHistoryEntry = { q: string; thumb?: string };

function loadFromStorage(): SearchHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry): SearchHistoryEntry | null => {
        // Tolerate the legacy string-only shape so users who upgrade from
        // a previous build don't lose their history.
        if (typeof entry === 'string') return { q: entry };
        if (entry && typeof entry === 'object' && typeof entry.q === 'string') {
          return {
            q: entry.q,
            thumb: typeof entry.thumb === 'string' ? entry.thumb : undefined,
          };
        }
        return null;
      })
      .filter((e): e is SearchHistoryEntry => e !== null);
  } catch {
    return [];
  }
}

function persist(entries: SearchHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

// Persists the user's recent search queries (and their first-result
// thumbnails) so the search dropdown can surface them on next visit.
// Most-recent-first; case-insensitively de-duplicated; capped at 15 entries.
export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryEntry[]>(loadFromStorage);

  const push = useCallback((q: string, thumb?: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const filtered = prev.filter(
        (e) => e.q.toLowerCase() !== trimmed.toLowerCase(),
      );
      const next: SearchHistoryEntry[] = [{ q: trimmed, thumb }, ...filtered].slice(
        0,
        MAX_ENTRIES,
      );
      persist(next);
      return next;
    });
  }, []);

  const remove = useCallback((q: string) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e.q !== q);
      persist(next);
      return next;
    });
  }, []);

  return { history, push, remove };
}
