'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RandomFilters } from '@/lib/youtube/types';
import { AutoRandomSection } from './sections/AutoRandomSection';
import { QueueSection } from './sections/QueueSection';
import { AIMcSection } from './sections/AIMcSection';
import { ThemeSection } from './sections/ThemeSection';
import { RoomSection } from './sections/RoomSection';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  roomCode: string;
  autoRandomEnabled: boolean;
  filters: RandomFilters;
  onAutoRandomToggle: (enabled: boolean) => void;
  onFiltersChange: (filters: Partial<RandomFilters>) => void;
  dragDropEnabled: boolean;
  onDragDropToggle: (enabled: boolean) => void;
  requesterPromptEnabled: boolean;
  onRequesterPromptToggle: (enabled: boolean) => void;
  mcEnabled: boolean;
  onMCToggle: (enabled: boolean) => void;
  mcVoice: string;
  onMcVoiceChange: (voice: string) => void;
}

export function SettingsSheet({
  open,
  onClose,
  roomCode,
  autoRandomEnabled,
  filters,
  onAutoRandomToggle,
  onFiltersChange,
  dragDropEnabled,
  onDragDropToggle,
  requesterPromptEnabled,
  onRequesterPromptToggle,
  mcEnabled,
  onMCToggle,
  mcVoice,
  onMcVoiceChange,
}: SettingsSheetProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.title')}
      // See NowPlayingCard for the rationale: `inert` instead of
      // aria-hidden avoids the focus-retention warning when the user
      // closes the sheet while a control inside still has focus.
      inert={!open}
      className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t('settings.closeLabel')}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel — bottom sheet on mobile, centered card on lg+
        The wrapper's empty padding area also closes the sheet on desktop:
        we look at e.target === e.currentTarget so clicks inside the card
        (which stops here via the inner div) don't bubble out. */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className={`absolute inset-x-0 bottom-0 lg:inset-0 lg:flex lg:items-center lg:justify-center lg:p-8 transition-transform duration-300 ease-out ${
          open
            ? 'translate-y-0 lg:translate-y-0'
            : 'translate-y-full lg:translate-y-0 lg:opacity-0'
        }`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full lg:max-w-lg max-h-[88vh] lg:max-h-[80vh] flex flex-col bg-surface border-t border-border lg:border lg:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden"
        >
          {/* Drag handle (mobile only — purely decorative) */}
          <div className="lg:hidden flex justify-center pt-2 pb-1">
            <span className="h-1 w-10 rounded-full bg-border" aria-hidden />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
            <h2 className="text-base font-semibold text-fg">
              {t('settings.title')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('settings.closeLabel')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg active:scale-95 transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="px-5 py-5 space-y-6">
              <AutoRandomSection
                enabled={autoRandomEnabled}
                filters={filters}
                onToggle={onAutoRandomToggle}
                onFiltersChange={onFiltersChange}
              />

              <QueueSection
                dragDropEnabled={dragDropEnabled}
                onDragDropToggle={onDragDropToggle}
                requesterPromptEnabled={requesterPromptEnabled}
                onRequesterPromptToggle={onRequesterPromptToggle}
              />

              <AIMcSection
                enabled={mcEnabled}
                onToggle={onMCToggle}
                mcVoice={mcVoice}
                onMcVoiceChange={onMcVoiceChange}
              />

              <ThemeSection />

              <RoomSection code={roomCode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
