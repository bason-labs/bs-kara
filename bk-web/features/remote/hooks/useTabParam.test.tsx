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

function setTabParam(tab: string | null) {
  useSearchParamsMock.mockReturnValue({
    get: (key: string) => (key === 'tab' ? tab : null),
  });
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
    setTabParam(null);
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
    setTabParam(null);
    usePathnameMock.mockReturnValue('/');
    const { result } = renderHook(() => useTabParam());
    const [, setTab] = result.current;
    act(() => {
      setTab('settings');
    });
    expect(replaceSpy).toHaveBeenCalledOnce();
    expect(replaceSpy).toHaveBeenCalledWith('/?tab=settings', { scroll: false });
  });
});
