'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic } from 'lucide-react';

interface RequesterDialogProps {
  open: boolean;
  // Pre-fills the input. For the add flow this is the last-used name from
  // localStorage; for the edit flow it's the song's existing requester.
  initialName: string;
  // The dialog is reused for both adding a new song and editing an existing
  // requester — `mode` only affects the secondary button's wording (Skip vs
  // Clear). Both intents resolve through `onConfirm(name | null)`: a non-null
  // string sets the name, `null` means "no requester".
  mode: 'add' | 'edit';
  onConfirm: (name: string | null) => void;
  onCancel: () => void;
}

export function RequesterDialog({
  open,
  initialName,
  mode,
  onConfirm,
  onCancel,
}: RequesterDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  // The parent remounts this dialog with a fresh `key` whenever the target
  // changes, so by the time we render `open` is already true. Without a
  // separate "rendered closed first, then flipped open" step, the
  // translate-y transition has nothing to animate from. `visible` defers
  // the open state by one frame so the off-screen styles paint before the
  // on-screen styles swap in.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    onConfirm(trimmed || null);
  }

  function handleSkip() {
    onConfirm(null);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('requester.title')}
      // See NowPlayingCard for the rationale: `inert` instead of
      // aria-hidden avoids the focus-retention warning when the user
      // dismisses the dialog while a button inside still has focus.
      inert={!open}
      className={`fixed inset-0 z-[60] ${open ? '' : 'pointer-events-none'}`}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t('requester.cancelAriaLabel')}
        tabIndex={open ? 0 : -1}
        onClick={onCancel}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel — bottom sheet on mobile, centered card on lg+. The wrapper's
          empty padding area closes the dialog on desktop via the
          `e.target === e.currentTarget` check; clicks inside the form
          stop at the form itself. */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
        className={`absolute inset-x-0 bottom-0 lg:inset-0 lg:flex lg:items-center lg:justify-center lg:p-8 transition-transform duration-300 ease-out ${
          visible
            ? 'translate-y-0 lg:translate-y-0'
            : 'translate-y-full lg:translate-y-0 lg:opacity-0'
        }`}
      >
        <form
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full lg:max-w-sm bg-surface border-t border-border lg:border lg:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden"
        >
          {/* Drag handle (mobile only — purely decorative) */}
          <div className="lg:hidden flex justify-center pt-2 pb-1">
            <span className="h-1 w-10 rounded-full bg-border" aria-hidden />
          </div>

          <div className="px-5 pb-5 pt-3 lg:pt-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-brand text-white shadow-glow">
                <Mic size={16} />
              </span>
              <h3 className="text-base font-semibold text-fg">
                {t('requester.title')}
              </h3>
            </div>
            <p className="text-xs text-muted leading-relaxed mb-3">
              {t('requester.hint')}
            </p>

            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder={t('requester.placeholder')}
              className="w-full h-11 px-4 text-sm bg-bg text-fg placeholder:text-muted border border-border rounded-full focus:outline-none focus:border-glow focus:ring-1 focus:ring-glow"
            />

            {/* Stacked + full-width on mobile so each button is an easy
                thumb target; row + auto-width on lg+ keeps the desktop
                layout compact. flex-col-reverse puts the primary action
                (Confirm) on top of the stack while preserving DOM order
                for keyboard users. */}
            <div className="mt-5 flex flex-col-reverse gap-2 lg:flex-row lg:items-center lg:justify-end">
              <button
                type="button"
                onClick={handleSkip}
                className="w-full lg:w-auto px-4 py-2.5 rounded-full text-sm font-medium text-muted hover:text-fg hover:bg-surface-2 transition-colors active:scale-95"
              >
                {mode === 'add' ? t('requester.skipButton') : t('requester.clearButton')}
              </button>
              <button
                type="submit"
                className="w-full lg:w-auto px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-brand shadow-glow hover:brightness-110 active:scale-95 transition"
              >
                {t('requester.confirmButton')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
