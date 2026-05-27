import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTabParam } from './useTabParam';

const useRouterMock = useRouter as unknown as ReturnType<typeof vi.fn>;
const usePathnameMock = usePathname as unknown as ReturnType<typeof vi.fn>;
const useSearchParamsMock = useSearchParams as unknown as ReturnType<typeof vi.fn>;

function makeSearchParams(params: Record<string, string>) {
  const entries = Object.entries(params);
  return {
    get: (key: string) => params[key] ?? null,
    toString: () => new URLSearchParams(entries).toString(),
  };
}

function setTabParam(tab: string | null) {
  useSearchParamsMock.mockReturnValue(
    makeSearchParams(tab !== null ? { tab } : {}),
  );
}

let replaceSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  replaceSpy = vi.fn();
  useRouterMock.mockReturnValue({ replace: replaceSpy });
  usePathnameMock.mockReturnValue('/');
  setTabParam(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useTabParam', () => {
  it('returns "search" when no ?tab param is present', () => {
    const { result } = renderHook(() => useTabParam());
    const [tab] = result.current;
    expect(tab).toBe('search');
  });

  it('returns "queue" when ?tab=queue', () => {
    setTabParam('queue');
    const { result } = renderHook(() => useTabParam());
    const [tab] = result.current;
    expect(tab).toBe('queue');
  });

  it('returns "search" (fallback) when ?tab=garbage is an invalid value', () => {
    setTabParam('garbage');
    const { result } = renderHook(() => useTabParam());
    const [tab] = result.current;
    expect(tab).toBe('search');
  });

  it('calling setTab("settings") invokes router.replace with ?tab=settings and { scroll: false }', () => {
    const { result } = renderHook(() => useTabParam());
    const [, setTab] = result.current;
    act(() => {
      setTab('settings');
    });
    expect(replaceSpy).toHaveBeenCalledOnce();
    expect(replaceSpy).toHaveBeenCalledWith('/?tab=settings', { scroll: false });
  });

  // Regression test for bug: setTab was constructing `?tab=<next>` from scratch,
  // silently dropping all other query params (e.g. ?room=1234).
  // Every call to setTab — including "View Queue" on AddedToast — would rewrite the
  // URL to `/?tab=queue`, losing the room code and breaking the next navigation/refresh.
  it('preserves other query params like ?room when setting tab', () => {
    useSearchParamsMock.mockReturnValue(makeSearchParams({ room: '1234' }));
    const { result } = renderHook(() => useTabParam());
    const [, setTab] = result.current;
    act(() => {
      setTab('queue');
    });
    expect(replaceSpy).toHaveBeenCalledOnce();
    const calledUrl: string = replaceSpy.mock.calls[0][0];
    const calledParams = new URLSearchParams(calledUrl.split('?')[1]);
    expect(calledParams.get('room')).toBe('1234');
    expect(calledParams.get('tab')).toBe('queue');
  });
});
