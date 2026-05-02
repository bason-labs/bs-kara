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
    fetch(`/api/suggestions?q=${encodeURIComponent(trimmed)}`)
      .then((r) => r.json())
      .then((data) => setFetched(data.suggestions ?? []))
      .catch(() => setFetched([]));
  }, [trimmed]);

  // Render-time gate: blank query always shows []. Avoids setState in the
  // effect body (which the lint rule forbids) while preserving the
  // observable behavior of the original "setSuggestions([]) on empty".
  const suggestions = trimmed ? fetched : [];

  const clear = useCallback(() => setFetched([]), []);

  return { suggestions, clear };
}
