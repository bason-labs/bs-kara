'use client';

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

interface UseHeaderAutoHideArgs {
  // The header only moves on the manual-search tab, where SearchPanel's results scroll.
  onManualSearch: boolean;
  isSearchFocused: boolean;
}

// Scroll-coupled chrome auto-hide for the mobile header. SearchPanel's
// results scroll drives a px offset (0..headerHeight + searchBarHeight) that
// translates the header and the search bar 1:1 with the gesture; `snap` is
// true only during the brief snap-to-rest transition at the end of a scroll.
export function useHeaderAutoHide({ onManualSearch, isSearchFocused }: UseHeaderAutoHideArgs) {
  const headerRef = useRef<HTMLElement>(null);
  // Seeded with a reasonable mobile header height so the first paint —
  // before useLayoutEffect measures the real value — lands close to the
  // correct offset. Without this, any content using `--header-h` for top
  // padding (e.g. the SearchSkeleton chrome) briefly renders at 0px and
  // overlaps the absolute-positioned mobile header.
  const [headerHeight, setHeaderHeight] = useState(56);
  useLayoutEffect(() => {
    if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
  }, []);

  const [chromeOffset, setChromeOffset] = useState(0);
  const [chromeSnap, setChromeSnap] = useState(false);
  const handleChromeChange = useCallback((offset: number, snap: boolean) => {
    setChromeOffset(offset);
    setChromeSnap(snap);
  }, []);

  // When the search input is focused on mobile we want to reclaim every pixel
  // for the keyboard + results: the header slides fully off-screen and the
  // spacer inside SearchPanel (which reserves room for the absolute header)
  // shrinks to zero. On desktop (lg+) the header is static and unaffected.
  const searchFocusHide = onManualSearch && isSearchFocused;
  // The spacer that SearchPanel adds for the absolute header must be 0 when
  // we've hidden it; otherwise the top of the results list has dead space.
  const effectiveHeaderHeight = searchFocusHide ? 0 : headerHeight;

  const headerShift = searchFocusHide
    ? headerHeight // fully above viewport
    : onManualSearch ? Math.min(headerHeight, Math.max(0, chromeOffset)) : 0;
  const headerSnap = onManualSearch && chromeSnap;
  // Header is absolutely positioned on mobile and floats above the list on
  // its own layer, so retraction is pure translateY — no margin animation,
  // no list reflow. The flex-1 content area below is padded by --header-h to
  // keep its content clear of the header's resting position.
  const headerStyle: CSSProperties = {
    transform: `translateY(-${headerShift}px)`,
  };

  return {
    headerRef,
    headerStyle,
    searchFocusHide,
    headerSnap,
    effectiveHeaderHeight,
    handleChromeChange,
  };
}
