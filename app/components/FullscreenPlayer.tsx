'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { YouTubeVideo } from '@/lib/youtube';
import { useAutoHide } from '@/hooks/useAutoHide';
import { VideoPlayer } from './host/VideoPlayer';

interface FullscreenPlayerProps {
  track: YouTubeVideo;
  isPlaying: boolean;
  volume: number;
  onSongEnd: () => void;
  onClose: () => void;
  onPlayingChange?: (playing: boolean) => void;
}

export function FullscreenPlayer({
  track,
  isPlaying,
  volume,
  onSongEnd,
  onClose,
  onPlayingChange,
}: FullscreenPlayerProps) {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const enteredFsRef = useRef(false);
  const chromeVisible = useAutoHide(2500);

  // Try to enter the browser Fullscreen API on mount; reverse on unmount.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || !el.requestFullscreen) return;
    el.requestFullscreen()
      .then(() => {
        enteredFsRef.current = true;
      })
      .catch(() => {});
    return () => {
      if (enteredFsRef.current && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // ESC at the document level closes the overlay.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // If the user exits fullscreen via browser chrome / iframe, close cleanly.
  useEffect(() => {
    function handleFsChange() {
      if (enteredFsRef.current && !document.fullscreenElement) {
        enteredFsRef.current = false;
        onClose();
      }
    }
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [onClose]);

  return (
    <div
      ref={wrapperRef}
      className={`fixed inset-0 z-[60] bg-black ${chromeVisible ? '' : 'cursor-none'}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('nowPlaying.label')}
    >
      {/* Video — fills the entire screen */}
      <div className="absolute inset-0">
        <VideoPlayer
          videoId={track.id}
          onSongEnd={onSongEnd}
          isPlaying={isPlaying}
          volume={volume}
          onPlayingChange={onPlayingChange}
        />
      </div>

      {/* Top-left track badge */}
      <div
        className={`absolute top-3 left-3 z-10 max-w-[60vw] transition-opacity duration-300 ${
          chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-surface/80 backdrop-blur-md border border-border rounded-full px-3 py-1.5 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-glow font-semibold">
            {t('nowPlaying.label')}
          </span>
          <span className="text-xs text-fg truncate max-w-[40vw]">{track.title}</span>
        </div>
      </div>

      {/* Top-right close */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t('player.closeFullscreen')}
        className={`absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-gradient-brand text-white shadow-glow flex items-center justify-center active:scale-95 transition-opacity duration-300 ${
          chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <X size={20} strokeWidth={2.4} />
      </button>
    </div>
  );
}
