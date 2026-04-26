'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import Image from 'next/image';
import MicOutline from 'react-ionicons/lib/MicOutline';
import SearchOutline from 'react-ionicons/lib/SearchOutline';
import { useDebounce } from 'use-debounce';
import { searchYouTube, YouTubeVideo } from '@/lib/youtube';
import { DEFAULT_HOT_HITS_QUERY } from '@/lib/config';
import { SongSkeleton } from './SongSkeleton';

interface SearchPanelProps {
  onAdd: (video: YouTubeVideo) => void;
}

export function SearchPanel({ onAdd }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showingHotHits, setShowingHotHits] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [debouncedQuery] = useDebounce(query, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  function startVoiceSearch() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice search is not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      setSuggestions([]);
      runSearch(transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 p-4 bg-white border-b border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div ref={wrapperRef} className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search for a song..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                {suggestions.map((s) => (
                  <li
                    key={s}
                    onMouseDown={() => handleSuggestionClick(s)}
                    className="px-3 py-2 text-sm text-gray-800 cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2"
                  >
                    <SearchOutline
                      color="#9ca3af"
                      width="14px"
                      height="14px"
                      cssClasses="flex-shrink-0"
                    />
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={startVoiceSearch}
            disabled={isListening}
            title="Voice search"
            className={`p-2 rounded-lg border transition-colors ${
              isListening
                ? 'border-red-400 text-red-500 bg-red-50 animate-pulse'
                : 'border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            <MicOutline
              color={isListening ? '#ef4444' : '#6b7280'}
              width="20px"
              height="20px"
            />
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(isInitialLoading || loading) &&
          Array.from({ length: 8 }).map((_, i) => <SongSkeleton key={i} />)}

        {!isInitialLoading && !loading && showingHotHits && results.length > 0 && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className="text-base">🔥</span>
            <h2 className="text-sm font-semibold text-gray-700">Hot Karaoke Hits</h2>
          </div>
        )}

        {!isInitialLoading && !loading && searched && results.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">No results found</p>
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
                  + Add to Queue
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
