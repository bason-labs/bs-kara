'use client';

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowUpLeft,
  Check,
  History,
  List,
  Mic,
  Plus,
  Search,
  SearchX,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import type { SearchError, YouTubeVideo } from '@bs-kara/shared';
import { searchYouTube } from '@/lib/youtube/client';
import { FILTER_CHIPS, type FilterChipId, buildChipKeywords } from '@/lib/filters';
import { useSearchHistory } from '@/features/remote/hooks/useSearchHistory';
import { useSearchSuggestions } from '@/features/remote/hooks/useSearchSuggestions';
import { useVoiceSearch } from '@/features/remote/hooks/useVoiceSearch';
import { useHotHits } from '@/features/remote/hooks/useHotHits';
import { useScrollOffset } from '@/hooks/useScrollOffset';
import { SkeletonRow } from './SkeletonRow';
import { FiltersSheet } from './FiltersSheet';

// Hoisted out of the render function so the array isn't recreated on every
// keystroke. The contents (6 nulls) are never read — only the length is
// used to spread into 6 SkeletonRow elements.
const SEARCH_SKELETONS = Array.from({ length: 6 });

// Static example pills shown in the voice listening overlay. Hoisted to
// avoid recreating the array each render and to keep the JSX tidy.
const VOICE_EXAMPLES = ['Duyên phận tone nữ', 'Đắp mộ cuộc tình', 'Lạc trôi karaoke'];

interface ResultRowProps {
  video: YouTubeVideo;
  queuedMap?: Map<string, string>;
  queuePositionMap?: Map<string, number>;
  currentPlayingId?: string | null;
  justAddedId: string | null;
  onAdd: (video: YouTubeVideo) => void;
}

const ResultRow = memo(function ResultRow({
  video,
  queuedMap,
  queuePositionMap,
  currentPlayingId,
  justAddedId,
  onAdd,
}: ResultRowProps) {
  const { t } = useTranslation();

  const isNowPlaying = video.id === currentPlayingId;
  const queueId = queuedMap?.get(video.id);
  const isQueued = Boolean(queueId);
  const isJustAdded = video.id === justAddedId;
  const queuePos = queuePositionMap?.get(video.id);

  // Card border/background depends on the state. Order matters: now-playing
  // wins, then just-added (transient celebration), then queued.
  const cardClass = isNowPlaying
    ? 'bg-gradient-to-br from-brand/5 to-surface border-glow/55 shadow-glow'
    : isJustAdded
      ? 'bg-surface border-accent/70 animate-just-added'
      : isQueued
        ? 'bg-surface border-accent/35'
        : 'bg-surface border-border';

  // Status pill: only one renders at a time. Now-playing > just-added > queued.
  let statusPill: React.ReactNode = null;
  if (isNowPlaying) {
    statusPill = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-glow/18 text-glow text-[11px] mt-1 w-fit">
        <span className="w-[5px] h-[5px] rounded-full bg-glow animate-pulse" />
        {t('search.statusNowPlaying')}
      </span>
    );
  } else if (isJustAdded) {
    statusPill = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/18 text-accent text-[11px] mt-1 w-fit">
        <Sparkles size={11} />
        {t('search.statusJustAdded')}
      </span>
    );
  } else if (isQueued) {
    statusPill = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[11px] mt-1 w-fit">
        <List size={11} />
        {t('search.statusQueued', { pos: queuePos })}
      </span>
    );
  }

  // Action button: idle (add), claimed (check, disabled), now-playing (check, disabled).
  let actionButton: React.ReactNode;
  if (isNowPlaying) {
    actionButton = (
      <button
        type="button"
        disabled
        aria-label={t('search.statusNowPlaying')}
        className="w-11 h-11 flex items-center justify-center rounded-full bg-transparent text-glow border border-glow/40 cursor-not-allowed"
      >
        <Check size={20} />
      </button>
    );
  } else if (isQueued || isJustAdded) {
    actionButton = (
      <div
        aria-label={isJustAdded ? t('search.statusJustAdded') : t('search.statusQueued', { pos: queuePos })}
        className="w-11 h-11 flex items-center justify-center rounded-full bg-surface-2 text-accent border border-accent/30 cursor-default"
      >
        <Check size={20} />
      </div>
    );
  } else {
    actionButton = (
      <button
        type="button"
        onClick={() => onAdd(video)}
        aria-label={t('search.addAriaLabel', { defaultValue: 'Add' })}
        className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-brand text-white shadow-glow active:scale-[0.92] transition-transform"
      >
        <Plus size={22} />
      </button>
    );
  }

  return (
    <div
      className={`grid grid-cols-[110px_1fr_44px] gap-3 p-3 rounded-[14px] border transition-colors ${cardClass}`}
    >
      {/* Thumbnail */}
      <div className="relative w-[110px] h-[62px] rounded-lg overflow-hidden bg-surface-2">
        <Image
          src={video.thumbnail}
          alt={video.title}
          fill
          className="object-cover"
          unoptimized
        />
        {video.duration && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/78 text-white text-[11px] font-semibold tabular-nums rounded">
            {video.duration}
          </span>
        )}
        {isNowPlaying && (
          <div className="absolute inset-0 bg-[rgba(6,16,15,0.55)] backdrop-blur-[2px] flex items-end justify-center gap-[3px] pb-2">
            <div className="w-[3px] bg-glow rounded-[1px] h-[30%] animate-eq-bar" />
            <div className="w-[3px] bg-glow rounded-[1px] h-[80%] animate-eq-bar-1" />
            <div className="w-[3px] bg-glow rounded-[1px] h-[55%] animate-eq-bar-2" />
            <div className="w-[3px] bg-glow rounded-[1px] h-[95%] animate-eq-bar-3" />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col justify-between min-w-0">
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-display)] text-[14.5px] font-semibold text-fg leading-[1.35] line-clamp-2">
            {video.title}
          </p>
          <p className="text-[11.5px] text-muted mt-0.5 truncate">{video.channel}</p>
        </div>
        {statusPill}
      </div>

      {/* Action */}
      <div className="flex items-center justify-center">{actionButton}</div>
    </div>
  );
});

interface SearchResultsProps {
  results: YouTubeVideo[];
  queuedMap?: Map<string, string>;
  queuePositionMap?: Map<string, number>;
  currentPlayingId?: string | null;
  justAddedId: string | null;
  onAdd: (video: YouTubeVideo) => void;
}

// React.memo so the up-to-15 result cards (each with an <Image>) don't
// re-render on unrelated SearchPanel state changes (typing, focus, etc.).
const SearchResults = memo(function SearchResults({
  results,
  queuedMap,
  queuePositionMap,
  currentPlayingId,
  justAddedId,
  onAdd,
}: SearchResultsProps) {
  return (
    <div className="space-y-3">
      {results.map((video) => (
        <ResultRow
          key={video.id}
          video={video}
          queuedMap={queuedMap}
          queuePositionMap={queuePositionMap}
          currentPlayingId={currentPlayingId}
          justAddedId={justAddedId}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
});

interface SearchPanelProps {
  onAdd: (video: YouTubeVideo) => void;
  queuedMap?: Map<string, string>;
  queuePositionMap?: Map<string, number>;
  currentPlayingId?: string | null;
  /* Height of the (separately rendered) header above the SearchPanel. */
  headerHeight?: number;
  onChromeChange?: (offset: number, snap: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
}

export function SearchPanel({
  onAdd,
  queuedMap,
  queuePositionMap,
  currentPlayingId,
  headerHeight = 0,
  onChromeChange,
  onFocusChange,
}: SearchPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<SearchError | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
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
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const justAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchBarHeight, setSearchBarHeight] = useState(0);

  // Measure the search-bar wrapper once it mounts so the offset can clamp
  // exactly to its height. useLayoutEffect (not useEffect) avoids a
  // first-frame flash where the bar is laid out at full height before the
  // scroll-coupled transform kicks in.
  useLayoutEffect(() => {
    if (searchBarRef.current) setSearchBarHeight(searchBarRef.current.offsetHeight);
  }, []);

  const { offset: chromeOffset, snap: chromeSnap } = useScrollOffset(
    resultsScrollRef,
    headerHeight + searchBarHeight,
  );

  const searchBarShift = Math.max(
    0,
    Math.min(headerHeight + searchBarHeight, chromeOffset),
  );

  useEffect(() => {
    onChromeChange?.(chromeOffset, chromeSnap);
  }, [chromeOffset, chromeSnap, onChromeChange]);

  useEffect(() => {
    onFocusChange?.(isFocused);
  }, [isFocused, onFocusChange]);

  const searchBarStyle: CSSProperties = {
    transform: `translateY(-${searchBarShift}px)`,
  };

  // Takes chips explicitly so callers (chip toggle, clear-all) can pass a
  // freshly computed Set without waiting for the activeChips state update to
  // flush. For form/suggestion/voice paths, we read activeChips directly.
  const runSearch = useCallback(
    async (q: string, chips: Set<FilterChipId>) => {
      const trimmed = q.trim();
      const chipKeywords = buildChipKeywords(chips);
      const finalQuery = [trimmed, chipKeywords].filter(Boolean).join(' ');
      if (!finalQuery) return;
      setIsFocused(false);
      inputRef.current?.blur();
      setLoading(true);
      setSearched(true);
      setSearchError(null);
      try {
        const { videos, error } = await searchYouTube(finalQuery);
        setResults(videos);
        setSearchError(error ?? null);
        if (videos.length > 0 && trimmed) {
          pushHistory(trimmed, videos[0]?.thumbnail);
        }
      } finally {
        setLoading(false);
      }
    },
    [pushHistory],
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
        // All chips off + empty query → drop back to idle.
        setSearched(false);
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

  // Close suggestion dropdown when clicking outside the search bar.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Transient "just added" highlight — clears after 1.7s so the celebration
  // animation can complete and the card settles into the queued state.
  // The ref guards against a second add clobbering the first timer, and the
  // cleanup effect below prevents a state update on an unmounted component.
  const handleAdd = useCallback(
    (video: YouTubeVideo) => {
      onAdd(video);
      if (justAddedTimerRef.current) clearTimeout(justAddedTimerRef.current);
      setJustAddedId(video.id);
      justAddedTimerRef.current = setTimeout(() => setJustAddedId(null), 1700);
    },
    [onAdd],
  );

  // Cleanup both pending timers on unmount so they can't fire after the
  // component has been removed from the tree.
  useEffect(() => {
    return () => {
      if (justAddedTimerRef.current) clearTimeout(justAddedTimerRef.current);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  // Display state machine. These five booleans are mutually exclusive in
  // practice; downstream JSX renders only the active section.
  const showTyping = isFocused && query.trim().length > 0 && !loading && !searched;
  const showHistory = isFocused && query.trim().length === 0 && !loading && !searched;
  const showLoading = loading;
  const showResults = searched && !loading;
  const showIdle = !showResults && !showLoading && !showTyping && !showHistory;

  // What to render in the content area when showIdle is true. Hot hits load
  // async — if they haven't arrived yet, fall through to the empty/skeleton
  // path covered by isInitialLoading below.
  const idleResults = hotHits;

  return (
    <div className="relative flex flex-col h-full">
      {/* Voice listening overlay — anchored to this panel, not the viewport,
          so it slides in under the chrome and doesn't fight z-index with
          other modals. */}
      {isListening && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[rgba(6,16,15,0.82)] dark:bg-[rgba(6,16,15,0.82)] backdrop-blur-[10px]">
          <button
            type="button"
            onClick={closeVoicePopup}
            aria-label={t('search.closeVoiceAriaLabel')}
            className="absolute top-5 right-5 w-11 h-11 flex items-center justify-center rounded-full bg-surface-2 border border-border"
          >
            <X size={20} />
          </button>
          <div className="relative w-[168px] h-[168px] flex items-center justify-center mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-glow/60 animate-voice-pulse" />
            <div className="absolute inset-0 rounded-full border-2 border-glow/60 animate-voice-pulse-delayed" />
            <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-brand shadow-glow flex items-center justify-center">
              <Mic size={42} className="text-white" strokeWidth={2} />
            </div>
          </div>
          <div className="flex items-center gap-1 mb-3 min-h-8">
            <span className="font-[family-name:var(--font-display)] text-2xl font-semibold text-fg tracking-tight">
              {interimTranscript || t('search.listeningMessage')}
            </span>
            <span className="w-0.5 h-[22px] bg-glow animate-blink" />
          </div>
          <p className="text-[13px] text-muted">{t('search.voiceListenHint')}</p>
          <div className="flex flex-wrap justify-center gap-2 mt-8 px-4">
            {VOICE_EXAMPLES.map((ex) => (
              <span
                key={ex}
                className="px-3 py-1.5 bg-surface border border-border rounded-full text-[11px] text-muted"
              >
                {ex}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        ref={searchBarRef}
        style={searchBarStyle}
        className={`absolute top-[var(--header-h)] left-0 right-0 z-20 bg-bg/85 backdrop-blur-md border-b border-border will-change-transform lg:sticky lg:top-0 lg:z-10 lg:overflow-visible lg:[transform:none]! ${
          chromeSnap
            ? 'transition-transform duration-300 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] lg:transition-none!'
            : ''
        }`}
      >
        <div ref={wrapperRef} className="relative px-4 pt-3 pb-3">
          <div className="flex items-center gap-2">
            {/* Back button — always in the DOM so the pill width is stable
                when focus fires (a conditional mount causes layout shift
                mid-focus which can lose the keyboard on some mobile
                browsers). Width-clips to 0 when idle, expands on focus. */}
            <div className={`lg:hidden overflow-hidden flex-shrink-0 flex items-center transition-[width] duration-150 ${
              isFocused ? 'w-9' : 'w-0'
            }`}>
              <button
                type="button"
                aria-label={t('search.backAriaLabel')}
                tabIndex={isFocused ? undefined : -1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  inputRef.current?.blur();
                  setIsFocused(false);
                }}
                className="flex items-center justify-center rounded-full p-2.5 text-muted hover:text-fg active:scale-95 transition-colors"
              >
                <ArrowLeft size={22} />
              </button>
            </div>
            <div
              className={`flex items-center gap-2 h-[52px] px-4 bg-surface border rounded-full transition-colors flex-1 ${
                isFocused ? 'border-glow ring-1 ring-glow/35' : 'border-border'
              }`}
            >
              <Search size={20} className={`flex-shrink-0 text-muted ${isFocused ? 'hidden lg:block' : ''}`} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsFocused(true);
              }}
              onFocus={() => {
                setIsFocused(true);
                // Tapping into the input after results are showing should
                // return to history/typing mode, not stay on stale results.
                setSearched(false);
              }}
              onBlur={() => {
                // Delay so a click on a suggestion can take effect before the
                // dropdown closes. We re-check activeElement to keep focus
                // styles when focus stays on the input.
                if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                blurTimerRef.current = setTimeout(() => {
                  if (document.activeElement !== inputRef.current) {
                    setIsFocused(false);
                  }
                }, 150);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runSearch(query, activeChips);
                }
              }}
              placeholder={t('search.placeholder')}
              className="flex-1 min-w-0 bg-transparent text-[15px] text-fg placeholder:text-muted outline-none"
            />
            {query.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery('');
                  setSearched(false);
                  clearSuggestions();
                  inputRef.current?.focus();
                }}
                aria-label={t('search.clearAriaLabel')}
                className="w-11 h-11 flex items-center justify-center text-muted hover:text-fg flex-shrink-0"
              >
                <X size={18} />
              </button>
            )}
            {/* Filter trigger */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                aria-label={t('search.filtersTriggerAriaLabel')}
                onClick={() => setShowFiltersSheet(true)}
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors ${
                  activeChips.size > 0
                    ? 'bg-glow/14 text-glow'
                    : 'text-muted hover:text-fg'
                }`}
              >
                <Sliders size={17} />
              </button>
              {activeChips.size > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-accent text-[#001a1a] text-[9.5px] font-bold flex items-center justify-center border-2 border-surface px-0.5">
                  {activeChips.size}
                </span>
              )}
            </div>
            </div>{/* end pill */}

            {/* Mic — outside the pill so the pill stays fully in-screen
                even when the back button is visible on mobile. */}
            <button
              type="button"
              onClick={startVoiceSearch}
              disabled={isListening}
              aria-label={t('search.voiceAriaLabel')}
              className={`flex-shrink-0 flex items-center justify-center p-2.5 rounded-full border transition-colors ${
                isListening
                  ? 'bg-gradient-brand text-white border-transparent animate-mic-pulse'
                  : 'bg-surface-2 text-fg border-border'
              }`}
            >
              <Mic size={20} />
            </button>
          </div>{/* end back-button + pill + mic row */}

          {/* Desktop suggestion / history dropdown — anchored to the search
              bar wrapper so it overlays the results without disturbing
              layout. Mobile uses inline rendering further down. */}
          {isFocused && query.trim().length === 0 && history.length > 0 && (
            <ul className="hidden lg:block absolute left-4 right-4 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-20 overflow-hidden max-h-[60vh] overflow-y-auto">
              {history.map((item) => (
                <li
                  key={item.q}
                  className="px-4 py-2 text-sm text-fg flex items-center gap-3 hover:bg-surface-2"
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
                    className="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-fg hover:bg-surface cursor-pointer flex-shrink-0"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {isFocused && query.trim().length > 0 && suggestions.length > 0 && (
            <ul className="hidden lg:block absolute left-4 right-4 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-20 overflow-hidden max-h-[60vh] overflow-y-auto">
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

        {/* Active-chips row — only rendered when chips are active and not
            mid-typing. Shows only active chips as removable pills. */}
        {activeChips.size > 0 && !showTyping && (
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 pb-3">
            {FILTER_CHIPS.filter((c) => activeChips.has(c.id)).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleChipToggle(chip.id)}
                className="flex-shrink-0 flex items-center gap-1 px-3 min-h-[44px] rounded-full bg-gradient-brand text-white text-xs font-medium shadow-glow"
              >
                {chip.label}
                <X size={13} strokeWidth={2.4} />
              </button>
            ))}
          </div>
        )}
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

        {showLoading &&
          SEARCH_SKELETONS.map((_, i) => <SkeletonRow key={i} />)}

        {/* Mobile inline history list — visible while focused with no query. */}
        {showHistory && history.length > 0 && (
          <ul className="lg:hidden -mx-1">
            {history.map((item) => (
              <li
                key={item.q}
                className="flex items-stretch border-b border-border/50"
              >
                <button
                  type="button"
                  onMouseDown={() => handleSuggestionClick(item.q)}
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
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeHistoryEntry(item.q);
                  }}
                  aria-label={t('search.removeHistoryAriaLabel')}
                  className="px-4 text-muted hover:text-fg flex-shrink-0 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Mobile inline suggestion list — visible while focused & typing. */}
        {showTyping && suggestions.length > 0 && (
          <ul className="lg:hidden -mx-1">
            {suggestions.map((s) => (
              <li key={s} className="flex items-stretch border-b border-border/50">
                <button
                  type="button"
                  onMouseDown={() => handleSuggestionClick(s)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left px-4 py-3 hover:bg-surface-2 active:bg-surface-2 cursor-pointer"
                >
                  <Search size={20} className="flex-shrink-0 text-muted" />
                  <span className="text-base text-fg truncate flex-1">{s}</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery(s);
                    inputRef.current?.focus();
                  }}
                  aria-label={t('search.fillQueryAriaLabel')}
                  className="px-4 text-muted hover:text-fg flex-shrink-0 cursor-pointer"
                >
                  <ArrowUpLeft size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Idle (no search yet): hot hits header + cards.
            On desktop the history dropdown is absolute-positioned above this
            content so both can show simultaneously. On mobile the inline
            history list replaces this area, so hide it when showHistory. */}
        {(showIdle || showHistory) && !isInitialLoading && idleResults.length > 0 && (
          <div className={showHistory ? 'hidden lg:block' : undefined}>
            <div className="flex items-center gap-2 px-1 pb-1">
              <span className="text-base">🔥</span>
              <h2 className="text-sm font-semibold text-fg">{t('search.hotHitsLabel')}</h2>
            </div>
            <SearchResults
              results={idleResults}
              queuedMap={queuedMap}
              queuePositionMap={queuePositionMap}
              currentPlayingId={currentPlayingId}
              justAddedId={justAddedId}
              onAdd={handleAdd}
            />
          </div>
        )}

        {(showIdle || showHistory) && isInitialLoading && (
          <div className={showHistory ? 'hidden lg:block' : undefined}>
            {SEARCH_SKELETONS.map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {showResults && results.length === 0 && (
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

        {showResults && results.length > 0 && (
          <SearchResults
            results={results}
            queuedMap={queuedMap}
            queuePositionMap={queuePositionMap}
            currentPlayingId={currentPlayingId}
            justAddedId={justAddedId}
            onAdd={handleAdd}
          />
        )}
      </div>

      <FiltersSheet
        open={showFiltersSheet}
        activeChips={activeChips}
        onApply={(chips) => {
          setActiveChips(chips);
          const trimmed = query.trim();
          if (trimmed || chips.size > 0) runSearch(query, chips);
          else { setSearched(false); setResults([]); setSearchError(null); }
        }}
        onClose={() => setShowFiltersSheet(false)}
      />
    </div>
  );
}
