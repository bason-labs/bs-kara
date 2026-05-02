'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from 'use-debounce';

// Debounced (300ms) Google-suggest fetch via the /api/suggestions BFF.
// Empty queries collapse the visible list (without re-fetching). Errors
// swallow back to []. Callers can `clear()` synchronously to drop the
// fetched array ahead of the debounce — used after voice input or
// suggestion selection so the dropdown doesn't briefly show stale matches.
export function useSearchSuggestions(query: string) {
  const [fetched, setFetched] = useState<string[]>([]);
  const [debouncedQuery] = useDebounce(query, 300);
  const trimmed = debouncedQuery.trim();

  useEffect(() => {
    if (!trimmed) return;
    // AbortController per effect run: cleanup aborts the in-flight fetch
    // when the debounced query changes again, or when the component
    // unmounts. Without this, a slow first response can resolve after a
    // later one and clobber the dropdown with stale suggestions.
    const ac = new AbortController();
    fetch(`/api/suggestions?q=${encodeURIComponent(trimmed)}`, {
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (ac.signal.aborted) return;
        setFetched(data.suggestions ?? []);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setFetched([]);
      });
    return () => ac.abort();
  }, [trimmed]);

  // Render-time gate: blank query always shows []. Avoids setState in the
  // effect body (which the lint rule forbids) while preserving the
  // observable behavior of the original "setSuggestions([]) on empty".
  const suggestions = trimmed ? fetched : [];

  const clear = useCallback(() => setFetched([]), []);

  return { suggestions, clear };
}
