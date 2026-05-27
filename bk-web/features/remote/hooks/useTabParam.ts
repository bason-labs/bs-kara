'use client';

import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { NavTab } from '@/features/remote/components/BottomNav';

const VALID_TABS = new Set<NavTab>(['search', 'queue', 'player', 'settings']);
const DEFAULT_TAB: NavTab = 'search';

function parseTab(raw: string | null): NavTab {
  if (raw !== null && VALID_TABS.has(raw as NavTab)) {
    return raw as NavTab;
  }
  return DEFAULT_TAB;
}

/**
 * URL-backed tab state. Reads `?tab` from the current URL and validates it
 * against the NavTab union. `setTab` calls `router.replace` (not push) so
 * the back button does not traverse tab history inside the room.
 */
export function useTabParam(): [NavTab, (next: NavTab) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = parseTab(searchParams.get('tab'));

  const setTab = useCallback(
    (next: NavTab) => {
      router.replace(`${pathname}?tab=${next}`, { scroll: false });
    },
    [router, pathname],
  );

  return [tab, setTab];
}
