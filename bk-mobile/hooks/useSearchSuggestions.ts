import { useCallback, useEffect, useRef, useState } from 'react';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export function useSearchSuggestions(query: string) {
  const [fetched, setFetched] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) {
      setFetched([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    const ac = new AbortController();
    timerRef.current = setTimeout(() => {
      fetch(`${API_BASE}/api/suggestions?q=${encodeURIComponent(trimmed)}`, {
        signal: ac.signal,
      })
        .then((r) => r.json() as Promise<{ suggestions?: string[] }>)
        .then((data) => {
          if (ac.signal.aborted) return;
          setFetched(data.suggestions ?? []);
        })
        .catch(() => {
          if (ac.signal.aborted) return;
          setFetched([]);
        });
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ac.abort();
    };
  }, [trimmed]);

  const suggestions = trimmed ? fetched : [];
  const clear = useCallback(() => setFetched([]), []);

  return { suggestions, clear };
}
