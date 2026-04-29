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

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

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
      aria-hidden={!open}
      className={`fixed inset-0 z-[60] flex items-end lg:items-center justify-center p-4 lg:p-8 transition-opacity duration-200 ${
        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <button
        type="button"
        aria-label={t('requester.cancelAriaLabel')}
        tabIndex={open ? 0 : -1}
        onClick={onCancel}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full lg:max-w-sm rounded-3xl bg-surface border border-border shadow-2xl p-5 transition-transform duration-200 ${
          open ? 'translate-y-0 scale-100' : 'translate-y-4 lg:translate-y-0 lg:scale-95'
        }`}
      >
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

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleSkip}
            className="px-4 py-2.5 rounded-full text-sm font-medium text-muted hover:text-fg hover:bg-surface-2 transition-colors active:scale-95"
          >
            {mode === 'add' ? t('requester.skipButton') : t('requester.clearButton')}
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-brand shadow-glow hover:brightness-110 active:scale-95 transition"
          >
            {t('requester.confirmButton')}
          </button>
        </div>
      </form>
    </div>
  );
}
