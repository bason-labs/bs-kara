'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Check, Mic, Search, SearchX, X } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { searchYouTube, YouTubeVideo } from '@/lib/youtube';
import { DEFAULT_HOT_HITS_QUERY } from '@/lib/config';
import { SongSkeleton } from './SongSkeleton';

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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showingHotHits, setShowingHotHits] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [debouncedQuery] = useDebounce(query, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const endAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const videos = await searchYouTube(DEFAULT_HOT_HITS_QUERY);
      if (!cancelled) {
        setResults(videos);
        setIsInitialLoading(false);
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

  async function runSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setShowSuggestions(false);
    setLoading(true);
    setSearched(true);
    setShowingHotHits(false);
    try {
      const videos = await searchYouTube(trimmed);
      setResults(videos);
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
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => setIsFocused(false)}
              placeholder={t('search.placeholder')}
              className={`w-full ${isFocused ? 'pl-11' : 'pl-4'} pr-10 py-2 text-sm bg-surface text-fg placeholder:text-muted border border-border rounded-l-full focus:outline-none focus:border-glow focus:ring-1 focus:ring-glow`}
            />
            {query.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery('');
                  setSuggestions([]);
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
                aria-label={t('search.clearAriaLabel')}
                className="absolute right-2 p-1 rounded-full text-muted hover:text-fg hover:bg-surface-2 cursor-pointer"
              >
                <X size={20} />
              </button>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-20 overflow-hidden">
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
            className="px-5 py-[9px] -ml-px bg-surface-2 text-fg border border-border rounded-r-full hover:bg-glow/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
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
            <p className="text-muted text-sm">{t('search.noResults')}</p>
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
              <div className="flex items-center justify-end mt-1">
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
                        className="px-3 py-1 text-xs font-semibold rounded-full border border-border text-muted bg-surface-2 inline-flex items-center gap-1 opacity-60 transition-opacity duration-300"
                      >
                        <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
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
                        className="group px-3 py-1 text-xs font-semibold rounded-full border border-border text-muted bg-surface-2 inline-flex items-center gap-1 hover:border-danger hover:text-danger hover:bg-surface transition-colors duration-200"
                      >
                        <Check size={14} strokeWidth={2.4} className="group-hover:hidden" />
                        <X size={14} strokeWidth={2.4} className="hidden group-hover:inline" />
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
                        className="px-3 py-1 text-xs font-semibold rounded-full border border-border text-muted bg-surface-2 inline-flex items-center gap-1 transition-colors duration-200"
                      >
                        <Check size={14} strokeWidth={2.4} />
                        {t('search.addedToQueueButton')}
                      </button>
                    );
                  }

                  return (
                    <button
                      onClick={() => onAdd(video)}
                      className="px-3 py-1 text-xs font-semibold text-white bg-gradient-brand rounded-full shadow-glow hover:brightness-110 active:scale-[0.97] transition duration-200"
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
