'use client';

import { useEffect, useState } from 'react';
import { LogOut, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RandomFilters } from '@bs-kara/shared';
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
  aiScoringEnabled: boolean;
  onAiScoringToggle: (enabled: boolean) => void;
  isHost: boolean;
  guestCanRemove: boolean;
  onGuestCanRemoveToggle: (enabled: boolean) => void;
  onLeave?: () => void;
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
  aiScoringEnabled,
  onAiScoringToggle,
  isHost,
  guestCanRemove,
  onGuestCanRemoveToggle,
  onLeave,
}: SettingsSheetProps) {
  const { t } = useTranslation();
  // Mirrors RequesterDialog / ConfirmDialog: when the parent lazy-mounts
  // this component with `open` already true (e.g. via next/dynamic on first
  // gear-icon click), the panel paints once at translate-y-0 and the
  // slide-up transition has nothing to animate from. `visible` defers the
  // on-screen styles by one frame so the off-screen styles paint first.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(id);
      // Cleanup runs after commit (not during render), so this synchronous
      // setState path doesn't violate react-hooks/set-state-in-effect.
      setVisible(false);
    };
  }, [open]);

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
          visible ? 'opacity-100' : 'opacity-0'
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
          visible
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
              {isHost && (
                <AutoRandomSection
                  enabled={autoRandomEnabled}
                  filters={filters}
                  onToggle={onAutoRandomToggle}
                  onFiltersChange={onFiltersChange}
                />
              )}

              {isHost && (
                <QueueSection
                  dragDropEnabled={dragDropEnabled}
                  onDragDropToggle={onDragDropToggle}
                  requesterPromptEnabled={requesterPromptEnabled}
                  onRequesterPromptToggle={onRequesterPromptToggle}
                  guestCanRemove={guestCanRemove}
                  onGuestCanRemoveToggle={onGuestCanRemoveToggle}
                />
              )}

              {isHost && (
                <AIMcSection
                  enabled={mcEnabled}
                  onToggle={onMCToggle}
                  mcVoice={mcVoice}
                  onMcVoiceChange={onMcVoiceChange}
                  aiScoringEnabled={aiScoringEnabled}
                  onAiScoringToggle={onAiScoringToggle}
                  panelOpen={open}
                />
              )}

              <ThemeSection />

              <RoomSection code={roomCode} isHost={isHost} />

              {/* Leave room — danger zone, always at the bottom */}
              {onLeave && (
                <div className="pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={onLeave}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-danger hover:bg-danger/8 transition-colors"
                  >
                    <LogOut size={16} />
                    {t('header.leaveButton')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
