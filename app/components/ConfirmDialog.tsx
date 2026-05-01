'use client';

import { useEffect } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      // `inert` (not aria-hidden) when closed: aria-hidden on a node that
      // still contains the element with browser focus — which happens the
      // moment the user clicks Confirm and we flip `open` to false — emits
      // an a11y violation in Chrome. `inert` automatically pulls focus out
      // and blocks pointer/keyboard interactions during the fade.
      inert={!open}
      className={`fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4 lg:p-8 transition-opacity duration-200 ${
        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <button
        type="button"
        aria-label={cancelLabel}
        tabIndex={open ? 0 : -1}
        onClick={onCancel}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full lg:max-w-sm rounded-3xl bg-surface border border-border shadow-2xl p-5 transition-transform duration-200 ${
          open ? 'translate-y-0 scale-100' : 'translate-y-4 lg:translate-y-0 lg:scale-95'
        }`}
      >
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">{message}</p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-full text-sm font-medium text-muted hover:text-fg hover:bg-surface-2 transition-colors active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-danger hover:opacity-90 shadow active:scale-95 transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
