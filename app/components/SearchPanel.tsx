'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useDebounce } from 'use-debounce';
import { searchYouTube, YouTubeVideo } from '@/lib/youtube';

interface SearchPanelProps {
  onAdd: (video: YouTubeVideo) => void;
}

export function SearchPanel({ onAdd }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedQuery] = useDebounce(query, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
                    <svg
                      className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                      />
                    </svg>
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
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
        {!searched && (
          <p className="text-sm text-gray-400 text-center mt-8">
            Search for a song to get started
          </p>
        )}

        {searched && !loading && results.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">No results found</p>
        )}

        {results.map((video) => (
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
