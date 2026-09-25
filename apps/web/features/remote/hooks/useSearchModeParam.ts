'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type SearchMode = 'manual' | 'voice';
export function useSearchModeParam(): [SearchMode, (mode: SearchMode) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mode = params.get('mode') === 'voice' ? 'voice' : 'manual';
  const setMode = useCallback((next: SearchMode) => {
    const updated = new URLSearchParams(params.toString());
    updated.set('mode', next);
    router.replace(`${pathname}?${updated.toString()}`, { scroll: false });
  }, [params, router, pathname]);
  return [mode, setMode];
}
