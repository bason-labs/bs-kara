'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Mic, Search, X } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { searchYouTube, YouTubeVideo } from '@/lib/youtube';
import { DEFAULT_HOT_HITS_QUERY } from '@/lib/config';
import { SongSkeleton } from './SongSkeleton';

interface SearchPanelProps {
  onAdd: (video: YouTubeVideo) => void;
}

export function SearchPanel({ onAdd }: SearchPanelProps) {
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
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={closeVoicePopup}
        >
          <div
            className="relative bg-white rounded-lg p-10 w-full max-w-2xl min-h-[480px] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeVoicePopup}
              aria-label={t('search.closeVoiceAriaLabel')}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 p-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h2 className="text-3xl font-medium text-gray-900 pr-10">
              {interimTranscript || t('search.listeningMessage')}
            </h2>
            <div className="flex-1 flex items-center justify-center">
              <div className="rounded-full bg-gray-100 p-5">
                <div className="mic-pulse w-20 h-20 rounded-full bg-red-600 flex items-center justify-center">
                  <Mic size={36} color="#ffffff" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="sticky top-0 z-10 p-4 bg-black border-b border-zinc-800">
        <form onSubmit={handleSubmit} className="flex items-center">
          <div ref={wrapperRef} className="relative flex items-center flex-1">
            {isFocused && (
              <span className="absolute left-4 flex items-center pointer-events-none">
                <Search size={18} color="#9ca3af" />
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
              className={`w-full ${isFocused ? 'pl-11' : 'pl-4'} pr-10 py-2 text-sm bg-[#121212] text-white placeholder-zinc-500 border border-zinc-700 rounded-l-full focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500`}
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
                className="absolute right-2 p-1 rounded-full hover:bg-zinc-800 cursor-pointer"
              >
                <X size={20} color="#ffffff" />
              </button>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 bg-[#212121] border border-zinc-700 rounded-lg shadow-lg z-20 overflow-hidden">
                {suggestions.map((s) => (
                  <li
                    key={s}
                    onMouseDown={() => handleSuggestionClick(s)}
                    className="px-4 py-2 text-sm text-white cursor-pointer hover:bg-zinc-700 flex items-center gap-3"
                  >
                    <Search size={16} color="#9ca3af" className="flex-shrink-0" />
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
            className="px-5 py-[9px] -ml-px bg-[#222222] border border-zinc-700 rounded-r-full hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
          >
            <Search size={20} color="#ffffff" />
          </button>
          <button
            type="button"
            onClick={startVoiceSearch}
            disabled={isListening}
            aria-label={t('search.voiceAriaLabel')}
            className="ml-3 rounded-full bg-[#222222] p-2.5 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
          >
            <Mic size={20} color="#ffffff" />
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(isInitialLoading || loading) &&
          Array.from({ length: 8 }).map((_, i) => <SongSkeleton key={i} />)}

        {!isInitialLoading && !loading && showingHotHits && results.length > 0 && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className="text-base">🔥</span>
            <h2 className="text-sm font-semibold text-gray-700">{t('search.hotHitsLabel')}</h2>
          </div>
        )}

        {!isInitialLoading && !loading && searched && results.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">{t('search.noResults')}</p>
        )}

        {!isInitialLoading && !loading && results.map((video) => (
          <div
            key={video.id}
            className="flex gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-100"
          >
            <div className="relative w-28 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-200">
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
                <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
                  {video.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{video.channel}</p>
              </div>
              <div className="flex items-center justify-end mt-1">
                <button
                  onClick={() => onAdd(video)}
                  className="px-3 py-1 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-full hover:bg-indigo-50 transition-colors"
                >
                  {t('search.addToQueueButton')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
