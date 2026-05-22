import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'bs_kara_search_history';
const MAX_ENTRIES = 15;

export type SearchHistoryEntry = { q: string; thumb?: string };

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) setHistory(parsed as SearchHistoryEntry[]);
      } catch {}
    });
  }, []);

  const push = useCallback((q: string, thumb?: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const filtered = prev.filter((e) => e.q.toLowerCase() !== trimmed.toLowerCase());
      const next: SearchHistoryEntry[] = [{ q: trimmed, thumb }, ...filtered].slice(0, MAX_ENTRIES);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback((q: string) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e.q !== q);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { history, push, remove };
}
