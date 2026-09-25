'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SettingsPanel, type SettingsPanelProps } from './SettingsPanel';

interface SettingsSheetProps extends Omit<SettingsPanelProps, 'panelOpen'> {
  open: boolean;
  onClose: () => void;
}

export function SettingsSheet({
  open,
  onClose,
  ...panelProps
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

          {/* Body — scroll container lives here (flex item in a column-flex card),
              NOT inside SettingsPanel. The desktop centering wrapper is a row-flex
              with align-items:center, so the card height is auto; a nested h-full
              element would resolve to auto and overflow-y-auto would never trigger. */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <SettingsPanel {...panelProps} panelOpen={open} />
          </div>
        </div>
      </div>
    </div>
  );
}
