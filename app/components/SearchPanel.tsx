'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowUpLeft, Check, History, Mic, Search, SearchX, X } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { searchYouTube, SearchError, YouTubeVideo } from '@/lib/youtube';
import { DEFAULT_HOT_HITS_QUERY } from '@/lib/config';
import { SongSkeleton } from './SongSkeleton';

type HistoryEntry = { q: string; thumb?: string };

interface SearchPanelProps {
  onAdd: (video: YouTubeVideo) => void;
  onRemove?: (queueId: string) => void;
  queuedMap?: Map<string, string>;
  currentPlayingId?: string | null;
  isQueueLoading?: boolean;
}

export function SearchPanel({
  onAdd,
  onRemove,
  queuedMap,
  currentPlayingId,
  isQueueLoading = false,
}: SearchPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<SearchError | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showingHotHits, setShowingHotHits] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('searchHistory');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((entry): HistoryEntry | null => {
          if (typeof entry === 'string') return { q: entry };
          if (entry && typeof entry === 'object' && typeof entry.q === 'string') {
            return {
              q: entry.q,
              thumb: typeof entry.thumb === 'string' ? entry.thumb : undefined,
            };
          }
          return null;
        })
        .filter((e): e is HistoryEntry => e !== null);
    } catch {
      return [];
    }
  });
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [debouncedQuery] = useDebounce(query, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const endAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { videos } = await searchYouTube(DEFAULT_HOT_HITS_QUERY);
        if (!cancelled) setResults(videos);
      } catch {
        // Network/abort during back nav can reject. Swallowing here so the
        // finally block still settles isInitialLoading — otherwise the panel
        // is stuck on skeletons forever.
      } finally {
        if (!cancelled) setIsInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch suggestions when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSuggestions([]);
      return;
    }
    fetch(`/api/suggestions?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data) => setSuggestions(data.suggestions ?? []))
      .catch(() => setSuggestions([]));
  }, [debouncedQuery]);

  function removeHistoryEntry(q: string) {
    setHistory((prev) => {
      const next = prev.filter((e) => e.q !== q);
      try {
        localStorage.setItem('searchHistory', JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function pushHistory(q: string, thumb?: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const filtered = prev.filter((e) => e.q.toLowerCase() !== trimmed.toLowerCase());
      const next: HistoryEntry[] = [{ q: trimmed, thumb }, ...filtered].slice(0, 15);
      try {
        localStorage.setItem('searchHistory', JSON.stringify(next));
      } catch {}
      return next;
    });
  }

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

  function dismissPanel() {
    setIsFocused(false);
    setShowSuggestions(false);
    inputRef.current?.blur();
    panelInputRef.current?.blur();
  }

  async function runSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    dismissPanel();
    setLoading(true);
    setSearched(true);
    setShowingHotHits(false);
    setSearchError(null);
    try {
      const { videos, error } = await searchYouTube(trimmed);
      setResults(videos);
      setSearchError(error ?? null);
      if (videos.length > 0) {
        pushHistory(trimmed, videos[0]?.thumbnail);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await runSearch(query);
  }

  function handleSuggestionClick(suggestion: string) {
    setQuery(suggestion);
    setSuggestions([]);
    runSearch(suggestion);
  }

  function playStartSound() {
    if (!startAudioRef.current) startAudioRef.current = new Audio('/audio/pop.mp3');
    startAudioRef.current.currentTime = 0;
    startAudioRef.current.play().catch(() => {});
  }

  function playEndSound() {
    if (!endAudioRef.current) endAudioRef.current = new Audio('/audio/ding.mp3');
    endAudioRef.current.currentTime = 0;
    endAudioRef.current.play().catch(() => {});
  }

  function startVoiceSearch() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t('search.voiceNotSupported'));
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = true;

    let endSoundPlayed = false;
    const playEndOnce = () => {
      if (!endSoundPlayed) {
        endSoundPlayed = true;
        playEndSound();
      }
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (finalTranscript) {
        playEndOnce();
        setQuery(finalTranscript);
        setSuggestions([]);
        setInterimTranscript('');
        setIsListening(false);
        runSearch(finalTranscript);
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = () => {
      playEndOnce();
      setIsListening(false);
    };

    recognition.onend = () => {
      playEndOnce();
      recognitionRef.current = null;
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    playStartSound();
    setInterimTranscript('');
    setIsListening(true);
    recognition.start();
  }

  function closeVoicePopup() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    } else {
      setIsListening(false);
    }
    setInterimTranscript('');
  }

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      if (startAudioRef.current) {
        startAudioRef.current.pause();
        startAudioRef.current = null;
      }
      if (endAudioRef.current) {
        endAudioRef.current.pause();
        endAudioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
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
                  runSearch(query);
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
                  setSuggestions([]);
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
      <div className="sticky top-0 z-10 p-4 bg-bg/85 backdrop-blur-md border-b border-border">
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
                  setSuggestions([]);
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
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(isInitialLoading || loading) &&
          Array.from({ length: 8 }).map((_, i) => <SongSkeleton key={i} />)}

        {!isInitialLoading && !loading && showingHotHits && results.length > 0 && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className="text-base">🔥</span>
            <h2 className="text-sm font-semibold text-fg">{t('search.hotHitsLabel')}</h2>
          </div>
        )}

        {!isInitialLoading && !loading && searched && results.length === 0 && (
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

        {!isInitialLoading && !loading && results.map((video) => (
          <div
            key={video.id}
            className="flex gap-3 p-3 bg-surface rounded-lg border border-border hover:border-glow/40 transition-colors"
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
              <div className="flex items-center justify-end mt-2">
                {(() => {
                  // While the queue is still loading from Firebase we don't
                  // yet know if this video is queued — render a placeholder
                  // button that's disabled, so the user can't accidentally
                  // double-add and the UI doesn't snap states once data
                  // arrives.
                  if (isQueueLoading) {
                    return (
                      <button
                        type="button"
                        disabled
                        aria-hidden="true"
                        className="px-4 py-1.5 text-sm lg:px-3 lg:py-1 lg:text-xs font-semibold rounded-full border border-border text-muted bg-surface-2 inline-flex items-center gap-1.5 lg:gap-1 opacity-60 transition-opacity duration-300"
                      >
                        <span className="inline-block w-4 h-4 lg:w-3.5 lg:h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        {t('search.addToQueueButton')}
                      </button>
                    );
                  }

                  const queueId = queuedMap?.get(video.id);
                  const isCurrent = currentPlayingId === video.id;

                  if (queueId && onRemove) {
                    // Added to queue → click removes it. Hover swaps icon to X
                    // and tints the button danger to telegraph the action.
                    return (
                      <button
                        type="button"
                        onClick={() => onRemove(queueId)}
                        aria-label={t('search.addedToQueueButton')}
                        className="group px-4 py-1.5 text-sm lg:px-3 lg:py-1 lg:text-xs font-semibold rounded-full border border-border text-muted bg-surface-2 inline-flex items-center gap-1.5 lg:gap-1 hover:border-danger hover:text-danger hover:bg-surface transition-colors duration-200"
                      >
                        <Check strokeWidth={2.4} className="w-4 h-4 lg:w-3.5 lg:h-3.5 group-hover:hidden" />
                        <X strokeWidth={2.4} className="w-4 h-4 lg:w-3.5 lg:h-3.5 hidden group-hover:inline" />
                        {t('search.addedToQueueButton')}
                      </button>
                    );
                  }

                  if (isCurrent) {
                    // Playing right now — show as added but not removable.
                    return (
                      <button
                        type="button"
                        disabled
                        aria-label={t('search.addedToQueueButton')}
                        className="px-4 py-1.5 text-sm lg:px-3 lg:py-1 lg:text-xs font-semibold rounded-full border border-border text-muted bg-surface-2 inline-flex items-center gap-1.5 lg:gap-1 transition-colors duration-200"
                      >
                        <Check strokeWidth={2.4} className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                        {t('search.addedToQueueButton')}
                      </button>
                    );
                  }

                  return (
                    <button
                      onClick={() => onAdd(video)}
                      className="px-4 py-1.5 text-sm lg:px-3 lg:py-1 lg:text-xs font-semibold text-white bg-gradient-brand rounded-full shadow-glow hover:brightness-110 active:scale-[0.97] transition duration-200"
                    >
                      {t('search.addToQueueButton')}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
