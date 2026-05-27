import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchSuggestions } from './useSearchSuggestions';

interface PendingFetch {
  signal?: AbortSignal;
  resolve: (suggestions: string[]) => void;
}

let pending: PendingFetch[] = [];

function flushMicrotasks() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  pending = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
      let outerResolve!: (
        value: { json: () => Promise<{ suggestions: string[] }> },
      ) => void;
      const promise = new Promise<{
        json: () => Promise<{ suggestions: string[] }>;
      }>((r) => {
        outerResolve = r;
      });
      pending.push({
        signal: init?.signal,
        resolve: (suggestions) =>
          outerResolve({ json: async () => ({ suggestions }) }),
      });
      return promise;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useSearchSuggestions', () => {
  // Regression: rapid typing can race two in-flight /api/suggestions
  // requests. Without abort guarding, whichever resolves last wins, even if
  // the user has already moved on to a different query — the dropdown
  // briefly shows suggestions for a stale prefix.
  it('does not let a stale response clobber a fresh one when the query changes', async () => {
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useSearchSuggestions(q),
      { initialProps: { q: 'first' } },
    );

    // Advance past the 300ms debounce → first fetch fires.
    await act(async () => {
      vi.advanceTimersByTime(300);
      await flushMicrotasks();
    });
    expect(pending).toHaveLength(1);
    const firstFetch = pending[0];

    // User keeps typing → query becomes 'second'. New debounce window.
    rerender({ q: 'second' });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await flushMicrotasks();
    });
    expect(pending).toHaveLength(2);
    const secondFetch = pending[1];

    // Second response lands first.
    await act(async () => {
      secondFetch.resolve(['second-result']);
      await flushMicrotasks();
    });
    expect(result.current.suggestions).toEqual(['second-result']);

    // First response lands later — without the abort guard, its .then
    // overwrites the fresh suggestions with the stale ones.
    await act(async () => {
      firstFetch.resolve(['first-result']);
      await flushMicrotasks();
    });
    expect(result.current.suggestions).toEqual(['second-result']);
  });

  it('aborts the in-flight fetch when the query changes', async () => {
    const { rerender } = renderHook(
      ({ q }: { q: string }) => useSearchSuggestions(q),
      { initialProps: { q: 'a' } },
    );
    await act(async () => {
      vi.advanceTimersByTime(300);
      await flushMicrotasks();
    });
    expect(pending).toHaveLength(1);
    const firstSignal = pending[0].signal;
    expect(firstSignal?.aborted).toBe(false);

    rerender({ q: 'b' });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await flushMicrotasks();
    });
    expect(firstSignal?.aborted).toBe(true);
  });

  it('aborts the in-flight fetch on unmount', async () => {
    const { unmount } = renderHook(() => useSearchSuggestions('hello'));
    await act(async () => {
      vi.advanceTimersByTime(300);
      await flushMicrotasks();
    });
    expect(pending).toHaveLength(1);
    const signal = pending[0].signal;
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
