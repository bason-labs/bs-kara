'use client';

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  FormEvent,
  type CSSProperties,
} from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowUpLeft, History, Mic, Search, SearchX, X } from 'lucide-react';
import type { SearchError, YouTubeVideo } from '@bs-kara/shared';
import { searchYouTube } from '@/lib/youtube/client';
import { useSearchHistory } from '@/features/remote/hooks/useSearchHistory';
import { useSearchSuggestions } from '@/features/remote/hooks/useSearchSuggestions';
import { useVoiceSearch } from '@/features/remote/hooks/useVoiceSearch';
import { useHotHits } from '@/features/remote/hooks/useHotHits';
import { useScrollOffset } from '@/hooks/useScrollOffset';
import { SkeletonRow } from './SkeletonRow';
import { AddToQueueButton } from './AddToQueueButton';
import { PlayNowButton } from './PlayNowButton';

// Hoisted out of the render function so the array isn't recreated on every
// keystroke. The contents (6 nulls) are never read — only the length is
// used to spread into 6 SkeletonRow elements.
const SEARCH_SKELETONS = Array.from({ length: 6 });

// Quick-filter chips. Labels are domain terms — kept in Vietnamese for both
// locales. The keyword is appended verbatim to the user query before hitting
// the BFF (same keyword-AND approach used by lib/random/picker.ts), so the
// final search becomes "<user query> <chip keywords>".
const FILTER_CHIPS = [
  { id: 'song-ca', label: 'Song ca', keyword: 'song ca' },
  { id: 'tone-nam', label: 'Tone nam', keyword: 'tone nam' },
  { id: 'tone-nu', label: 'Tone nữ', keyword: 'tone nữ' },
  { id: 'tru-tinh', label: 'Trữ tình', keyword: 'trữ tình' },
  { id: 'ca-co', label: 'Ca cổ', keyword: 'ca cổ' },
  { id: 'nhac-tre', label: 'Nhạc trẻ', keyword: 'nhạc trẻ' },
] as const;

type FilterChipId = (typeof FILTER_CHIPS)[number]['id'];

function buildChipKeywords(chips: Set<FilterChipId>): string {
  return FILTER_CHIPS.filter((c) => chips.has(c.id))
    .map((c) => c.keyword)
    .join(' ');
}

interface SearchResultsProps {
  results: YouTubeVideo[];
  isQueueLoading: boolean;
  queuedMap?: Map<string, string>;
  currentPlayingId?: string | null;
  onAdd: (video: YouTubeVideo) => void;
  onRemove?: (queueId: string) => void;
  onPlayNow?: (video: YouTubeVideo) => void;
}

// React.memo so the up-to-15 result cards (each with an <Image>) don't
// re-render on unrelated SearchPanel state changes (typing, focus, etc.).
// Memo's shallow check covers all six props; the parent already passes
// reference-stable values: results is local state, queuedMap is useMemo,
// the rest are primitives or useCallback'd functions.
const SearchResults = memo(function SearchResults({
  results,
  isQueueLoading,
  queuedMap,
  currentPlayingId,
  onAdd,
  onRemove,
  onPlayNow,
}: SearchResultsProps) {
  return (
    <>
      {results.map((video) => (
        <div
          key={video.id}
          className="group flex gap-3 p-3 bg-surface rounded-lg border border-border hover:border-glow/40 transition-colors"
        >
          <div className="relative w-28 h-16 flex-shrink-0 rounded overflow-hidden bg-surface-2">
            <Image
              src={video.thumbnail}
              alt={video.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>

          <div className="flex flex-col justify-between flex-1 min-w-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg line-clamp-2 leading-tight">
                {video.title}
              </p>
              <p className="text-xs text-muted mt-0.5 truncate">{video.channel}</p>
            </div>
            <div className="flex items-center justify-end gap-2 lg:gap-1 mt-2">
              {onPlayNow && (
                <PlayNowButton
                  videoId={video.id}
                  currentPlayingId={currentPlayingId}
                  onClick={() => onPlayNow(video)}
                />
              )}
              <AddToQueueButton
                video={video}
                isQueueLoading={isQueueLoading}
                queuedMap={queuedMap}
                currentPlayingId={currentPlayingId}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            </div>
          </div>
        </div>
      ))}
    </>
  );
});

interface SearchPanelProps {
  onAdd: (video: YouTubeVideo) => void;
  onRemove?: (queueId: string) => void;
  onPlayNow?: (video: YouTubeVideo) => void;
  queuedMap?: Map<string, string>;
  currentPlayingId?: string | null;
  isQueueLoading?: boolean;
  /* Height of the (separately rendered) header above the SearchPanel. The
     scroll-coupled retraction first eats this many pixels of offset hiding
     the header before it begins translating the local search bar — keeping
     a 1:1 px-of-scroll-to-px-of-chrome ratio for the whole stack. */
  headerHeight?: number;
  /* Fires on every offset update. `offset` is the accumulated px the
     chrome should retract by (0..headerHeight + searchBarHeight); `snap`
     is true only during the brief snap-to-rest tween at the end of a
     gesture, so the parent can mirror the same transition behavior on
     the header. */
  onChromeChange?: (offset: number, snap: boolean) => void;
}

export function SearchPanel({
  onAdd,
  onRemove,
  onPlayNow,
  queuedMap,
  currentPlayingId,
  isQueueLoading = false,
  headerHeight = 0,
  onChromeChange,
}: SearchPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<SearchError | null>(null);
  const [showingHotHits, setShowingHotHits] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  // Active quick-filter chip ids. Persisted across searches within the same
  // session via React state only — refreshing the page resets, which matches
  // the rest of the search UI (history is the only thing that survives reload).
  const [activeChips, setActiveChips] = useState<Set<FilterChipId>>(
    () => new Set(),
  );

  const { hotHits, isLoading: isInitialLoading } = useHotHits();
  const { history, push: pushHistory, remove: removeHistoryEntry } = useSearchHistory();
  const { suggestions, clear: clearSuggestions } = useSearchSuggestions(query);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelInputRef = useRef<HTMLInputElement>(null);
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const [searchBarHeight, setSearchBarHeight] = useState(0);

  // Measure the search-bar wrapper once it mounts so the offset can clamp
  // exactly to its height. useLayoutEffect (not useEffect) avoids a
  // first-frame flash where the bar is laid out at full height before the
  // scroll-coupled transform kicks in.
  useLayoutEffect(() => {
    if (searchBarRef.current) setSearchBarHeight(searchBarRef.current.offsetHeight);
  }, []);

  // Scroll-coupled chrome offset. `maxOffset` is the total chrome stack
  // height (header + search bar) so scroll delta retracts everything 1:1.
  // The `lg:…!` Tailwind overrides on the search-bar wrapper (and on the
  // header in RemoteClient) cancel both the inline transform and the snap
  // transition on desktop, so we don't need a media query to gate the hook.
  const { offset: chromeOffset, snap: chromeSnap } = useScrollOffset(
    resultsScrollRef,
    headerHeight + searchBarHeight,
  );

  // Synchronized retraction: header and search bar share the same shift
  // (= chromeOffset). For chromeOffset 0..headerHeight the chrome reads
  // as one rigid block sliding up. Past that point the header is fully
  // off-screen, so the search bar's continued translate is invisible.
  // The scroll container holds an in-list spacer (first child below)
  // sized to header + search bar — it scrolls away with the list and
  // visually fills the chrome's resting area at scrollTop = 0.
  // The explicit clamp is defensive — useScrollOffset already clamps
  // chromeOffset to [0, maxOffset], but we don't want to depend on that
  // contract being preserved across hook refactors.
  const searchBarShift = Math.max(
    0,
    Math.min(headerHeight + searchBarHeight, chromeOffset),
  );

  useEffect(() => {
    onChromeChange?.(chromeOffset, chromeSnap);
  }, [chromeOffset, chromeSnap, onChromeChange]);

  const searchBarStyle: CSSProperties = {
    transform: `translateY(-${searchBarShift}px)`,
  };

  // Render-time choice between hot hits (initial) and user-search results.
  // Avoids a useEffect that would copy hotHits into local state — that
  // antipattern triggers react-hooks/set-state-in-effect AND the same
  // "slow hot-hits clobbers a fast search" race we used to gate on
  // `searched`.
  const displayedResults = searched ? results : hotHits;

  const dismissPanel = useCallback(() => {
    setIsFocused(false);
    setShowSuggestions(false);
    inputRef.current?.blur();
    panelInputRef.current?.blur();
  }, []);

  // Takes chips explicitly so callers (chip toggle, clear-all) can pass a
  // freshly computed Set without waiting for the activeChips state update to
  // flush. For form/suggestion/voice paths, we read activeChips directly.
  const runSearch = useCallback(
    async (q: string, chips: Set<FilterChipId>) => {
      const trimmed = q.trim();
      const chipKeywords = buildChipKeywords(chips);
      // Final query is the user's typed query first, then chip keywords —
      // no dedupe, no reorder. YouTube handles relevance.
      const finalQuery = [trimmed, chipKeywords].filter(Boolean).join(' ');
      if (!finalQuery) return;
      dismissPanel();
      setLoading(true);
      setSearched(true);
      setShowingHotHits(false);
      setSearchError(null);
      try {
        const { videos, error } = await searchYouTube(finalQuery);
        setResults(videos);
        setSearchError(error ?? null);
        // Only record the user-typed portion in history — chip-only or
        // chip-augmented searches shouldn't pollute the recents list with
        // filter keywords the user never typed.
        if (videos.length > 0 && trimmed) {
          pushHistory(trimmed, videos[0]?.thumbnail);
        }
      } finally {
        setLoading(false);
      }
    },
    [dismissPanel, pushHistory],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      await runSearch(query, activeChips);
    },
    [query, runSearch, activeChips],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setQuery(suggestion);
      clearSuggestions();
      runSearch(suggestion, activeChips);
    },
    [clearSuggestions, runSearch, activeChips],
  );

  const handleVoiceFinal = useCallback(
    (transcript: string) => {
      setQuery(transcript);
      clearSuggestions();
      runSearch(transcript, activeChips);
    },
    [clearSuggestions, runSearch, activeChips],
  );

  const handleChipToggle = useCallback(
    (id: FilterChipId) => {
      const next = new Set(activeChips);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setActiveChips(next);
      const trimmed = query.trim();
      if (trimmed || next.size > 0) {
        runSearch(query, next);
      } else {
        // All chips off + empty query → drop back to hot hits.
        setSearched(false);
        setShowingHotHits(true);
        setResults([]);
        setSearchError(null);
      }
    },
    [activeChips, query, runSearch],
  );

  const handleClearChips = useCallback(() => {
    const empty = new Set<FilterChipId>();
    setActiveChips(empty);
    const trimmed = query.trim();
    if (trimmed) {
      runSearch(query, empty);
    } else {
      setSearched(false);
      setShowingHotHits(true);
      setResults([]);
      setSearchError(null);
    }
  }, [query, runSearch]);

  const handleVoiceUnsupported = useCallback(() => {
    alert(t('search.voiceNotSupported'));
  }, [t]);

  const {
    isListening,
    interimTranscript,
    start: startVoiceSearch,
    stop: closeVoicePopup,
  } = useVoiceSearch({
    onFinal: handleVoiceFinal,
    onUnsupported: handleVoiceUnsupported,
  });

  useEffect(() => {
    if (isFocused) panelInputRef.current?.focus();
  }, [isFocused]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Negative inline margin lets the row's first/last chip bleed into the
  // wrapper padding so a horizontal swipe feels edge-to-edge on mobile,
  // while the wrap behaviour on lg+ keeps the row aligned with the form.
  const renderChipRow = (extraClass = '') => (
    <div
      role="group"
      aria-label={t('search.filtersGroupAriaLabel')}
      className={`-mx-4 px-4 flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0 lg:flex-wrap lg:overflow-visible ${extraClass}`}
    >
      {FILTER_CHIPS.map((chip) => {
        const active = activeChips.has(chip.id);
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={active}
            onClick={() => handleChipToggle(chip.id)}
            className={`flex-shrink-0 inline-flex items-center px-4 py-2 rounded-full text-xs font-medium tracking-wide whitespace-nowrap border transition-colors active:scale-95 ${
              active
                ? 'bg-gradient-brand text-white border-transparent shadow-glow'
                : 'bg-surface text-muted border-border hover:text-fg hover:border-glow/40'
            }`}
          >
            {chip.label}
          </button>
        );
      })}
      {activeChips.size > 0 && (
        <button
          type="button"
          onClick={handleClearChips}
          aria-label={t('search.clearFiltersAriaLabel')}
          className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium text-danger border border-danger/40 bg-danger/10 hover:bg-danger/20 active:scale-95 whitespace-nowrap"
        >
          <X size={14} />
          <span>{t('search.clearFilters', { count: activeChips.size })}</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="relative flex flex-col h-full">
      {isListening && (
        <div
          role="button"
          tabIndex={-1}
          aria-label={t('search.closeVoiceAriaLabel')}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeVoicePopup}
        >
          <div
            className="relative bg-surface text-fg border border-border rounded-2xl p-6 w-full max-w-md min-h-[280px] flex flex-col shadow-glow cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeVoicePopup}
              aria-label={t('search.closeVoiceAriaLabel')}
              className="absolute top-3 right-3 p-1 text-muted hover:text-fg"
            >
              <X size={18} />
            </button>
            <h2 className="text-xl font-medium text-fg pr-8">
              {interimTranscript || t('search.listeningMessage')}
            </h2>
            <div className="flex-1 flex items-center justify-center">
              <div className="rounded-full bg-surface-2 p-3">
                <div className="mic-pulse w-14 h-14 rounded-full bg-brand flex items-center justify-center">
                  <Mic size={24} className="text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {isFocused && (
        <div className="lg:hidden fixed inset-0 z-40 bg-bg flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center gap-2 px-2 py-2 border-b border-border">
            <button
              type="button"
              onClick={dismissPanel}
              aria-label={t('search.backAriaLabel')}
              className="p-2 rounded-full text-fg hover:bg-surface-2 cursor-pointer"
            >
              <ArrowLeft size={22} />
            </button>
            <input
              ref={panelInputRef}
              type="text"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runSearch(query, activeChips);
                }
              }}
              placeholder={t('search.placeholder')}
              className="flex-1 min-w-0 bg-surface text-fg placeholder:text-muted rounded-full px-4 py-2 text-sm border border-border focus:outline-none focus:border-glow focus:ring-1 focus:ring-glow"
            />
            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  clearSuggestions();
                  panelInputRef.current?.focus();
                }}
                aria-label={t('search.clearAriaLabel')}
                className="p-2 rounded-full bg-surface-2 text-fg border border-border cursor-pointer"
              >
                <X size={20} />
              </button>
            ) : (
              <button
                type="button"
                onClick={startVoiceSearch}
                disabled={isListening}
                aria-label={t('search.voiceAriaLabel')}
                className="p-2 rounded-full bg-surface-2 text-fg border border-border disabled:opacity-50 cursor-pointer"
              >
                <Mic size={20} />
              </button>
            )}
          </div>
          {/* Chip row stays visible while the focus overlay is open so users
              can toggle filters mid-typing. mx/px values match the overlay's
              own gutter so the chips align with the input above. */}
          <div className="px-2 py-2 border-b border-border">
            {renderChipRow()}
          </div>
          <ul className="flex-1 overflow-y-auto">
            {query.trim().length === 0
              ? history.map((item) => (
                  <li key={item.q} className="flex items-stretch border-b border-border/50">
                    <button
                      type="button"
                      onClick={() => handleSuggestionClick(item.q)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left px-4 py-3 hover:bg-surface-2 active:bg-surface-2 cursor-pointer"
                    >
                      <History size={20} className="flex-shrink-0 text-muted" />
                      <span className="text-base text-fg truncate flex-1">{item.q}</span>
                      {item.thumb && (
                        <Image
                          src={item.thumb}
                          alt=""
                          width={64}
                          height={36}
                          className="rounded object-cover flex-shrink-0"
                          unoptimized
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={t('search.fillQueryAriaLabel')}
                      onClick={() => {
                        setQuery(item.q);
                        panelInputRef.current?.focus();
                      }}
                      className="px-4 text-muted hover:text-fg flex-shrink-0 cursor-pointer"
                    >
                      <ArrowUpLeft size={20} />
                    </button>
                  </li>
                ))
              : suggestions.map((s) => (
                  <li key={s} className="flex items-stretch border-b border-border/50">
                    <button
                      type="button"
                      onClick={() => handleSuggestionClick(s)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left px-4 py-3 hover:bg-surface-2 active:bg-surface-2 cursor-pointer"
                    >
                      <Search size={20} className="flex-shrink-0 text-muted" />
                      <span className="text-base text-fg truncate flex-1">{s}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={t('search.fillQueryAriaLabel')}
                      onClick={() => {
                        setQuery(s);
                        panelInputRef.current?.focus();
                      }}
                      className="px-4 text-muted hover:text-fg flex-shrink-0 cursor-pointer"
                    >
                      <ArrowUpLeft size={20} />
                    </button>
                  </li>
                ))}
          </ul>
        </div>
      )}
      <div
        ref={searchBarRef}
        style={searchBarStyle}
        className={`absolute top-[var(--header-h)] left-0 right-0 z-20 p-4 bg-bg/85 backdrop-blur-md border-b border-border will-change-transform lg:sticky lg:top-0 lg:z-10 lg:overflow-visible lg:[transform:none]! ${
          chromeSnap
            ? 'transition-transform duration-300 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] lg:transition-none!'
            : ''
        }`}
      >
        <form onSubmit={handleSubmit} className="flex items-center">
          <div ref={wrapperRef} className="relative flex items-center flex-1">
            {isFocused && (
              <span className="absolute left-4 flex items-center pointer-events-none text-muted">
                <Search size={18} />
              </span>
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                setIsFocused(true);
                setShowSuggestions(true);
              }}
              onBlur={() => {
                setTimeout(() => {
                  const el = document.activeElement;
                  if (el === panelInputRef.current || el === inputRef.current) return;
                  setIsFocused(false);
                  setShowSuggestions(false);
                }, 0);
              }}
              placeholder={t('search.placeholder')}
              className={`w-full h-10 ${isFocused ? 'pl-11' : 'pl-4'} pr-10 text-sm bg-surface text-fg placeholder:text-muted border border-border rounded-l-full focus:outline-none focus:border-glow focus:ring-1 focus:ring-glow`}
            />
            {query.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery('');
                  clearSuggestions();
                  setShowSuggestions(true);
                  inputRef.current?.focus();
                }}
                aria-label={t('search.clearAriaLabel')}
                className="absolute right-2 p-1 rounded-full text-muted hover:text-fg hover:bg-surface-2 cursor-pointer"
              >
                <X size={20} />
              </button>
            )}
            {showSuggestions && query.trim().length === 0 && history.length > 0 && (
              <ul className="hidden lg:block absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-20 overflow-hidden max-h-[60vh] overflow-y-auto">
                {history.map((item) => (
                  <li
                    key={item.q}
                    className="group px-4 py-2 text-sm text-fg flex items-center gap-3 hover:bg-surface-2"
                  >
                    <button
                      type="button"
                      onMouseDown={() => handleSuggestionClick(item.q)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <History size={16} className="flex-shrink-0 text-muted" />
                      <span className="truncate flex-1">{item.q}</span>
                      {item.thumb && (
                        <Image
                          src={item.thumb}
                          alt=""
                          width={64}
                          height={36}
                          className="rounded object-cover flex-shrink-0"
                          unoptimized
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeHistoryEntry(item.q);
                      }}
                      aria-label={t('search.removeHistoryAriaLabel')}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-full text-muted hover:text-fg hover:bg-surface cursor-pointer flex-shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showSuggestions && query.trim().length > 0 && suggestions.length > 0 && (
              <ul className="hidden lg:block absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-20 overflow-hidden max-h-[60vh] overflow-y-auto">
                {suggestions.map((s) => (
                  <li
                    key={s}
                    onMouseDown={() => handleSuggestionClick(s)}
                    className="px-4 py-2 text-sm text-fg cursor-pointer hover:bg-surface-2 flex items-center gap-3"
                  >
                    <Search size={16} className="flex-shrink-0 text-muted" />
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            aria-label={t('search.submitAriaLabel')}
            className="h-10 px-5 -ml-px bg-surface-2 text-fg border border-border rounded-r-full hover:bg-glow/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
          >
            <Search size={20} />
          </button>
          <button
            type="button"
            onClick={startVoiceSearch}
            disabled={isListening}
            aria-label={t('search.voiceAriaLabel')}
            className="ml-3 rounded-full bg-surface-2 text-fg border border-border p-2.5 hover:bg-glow/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
          >
            <Mic size={20} />
          </button>
        </form>
        {/* Chip row sits inside the same wrapper as the form so its height
            is captured by useLayoutEffect → searchBarHeight, which keeps the
            scroll-coupled retraction (header + bar + chips) consistent. */}
        <div className="mt-3">{renderChipRow()}</div>
      </div>

      <div
        ref={resultsScrollRef}
        style={{ '--searchbar-h': `${searchBarHeight}px` } as CSSProperties}
        className="flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] px-4 pb-4 lg:pt-4 space-y-3"
      >
        <div
          aria-hidden
          className="lg:hidden shrink-0"
          style={{ height: 'calc(var(--header-h) + var(--searchbar-h))' }}
        />
        {(isInitialLoading || loading) &&
          SEARCH_SKELETONS.map((_, i) => <SkeletonRow key={i} />)}

        {!isInitialLoading && !loading && showingHotHits && displayedResults.length > 0 && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className="text-base">🔥</span>
            <h2 className="text-sm font-semibold text-fg">{t('search.hotHitsLabel')}</h2>
          </div>
        )}

        {!isInitialLoading && !loading && searched && displayedResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <SearchX size={64} className="mb-4 text-muted opacity-60" />
            <p className="text-muted text-sm">
              {searchError === 'quota'
                ? t('search.errorQuota')
                : searchError === 'generic'
                  ? t('search.errorGeneric')
                  : t('search.noResults')}
            </p>
          </div>
        )}

        {!isInitialLoading && !loading && (
          <SearchResults
            results={displayedResults}
            isQueueLoading={isQueueLoading}
            queuedMap={queuedMap}
            currentPlayingId={currentPlayingId}
            onAdd={onAdd}
            onRemove={onRemove}
            onPlayNow={onPlayNow}
          />
        )}
      </div>
    </div>
  );
}
