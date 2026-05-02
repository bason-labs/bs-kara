'use client';

import { useEffect, useState } from 'react';

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
  // Mirrors RequesterDialog: callers may remount us on each open via a
  // `key`, so the closed state never gets a chance to paint before `open`
  // is already true. `visible` defers the on-screen styles by one frame
  // so the slide-up + fade transitions actually animate.
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
      className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={cancelLabel}
        tabIndex={open ? 0 : -1}
        onClick={onCancel}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel — bottom sheet on mobile, centered card on lg+. The wrapper's
          empty padding area closes the dialog on desktop via the
          `e.target === e.currentTarget` check; clicks inside the card
          stop at the inner div. */}
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
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full lg:max-w-sm bg-surface border-t border-border lg:border lg:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden"
        >
          {/* Drag handle (mobile only — purely decorative) */}
          <div className="lg:hidden flex justify-center pt-2 pb-1">
            <span className="h-1 w-10 rounded-full bg-border" aria-hidden />
          </div>

          <div className="px-5 pb-5 pt-3 lg:pt-5">
            <h3 className="text-base font-semibold text-fg">{title}</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">{message}</p>

            {/* Stacked + full-width on mobile so each button is an easy
                thumb target; row + auto-width on lg+ keeps the desktop
                layout compact. flex-col-reverse puts the primary action
                (Confirm) on top of the stack while preserving DOM order
                for keyboard users. */}
            <div className="mt-5 flex flex-col-reverse gap-2 lg:flex-row lg:items-center lg:justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="w-full lg:w-auto px-4 py-2.5 rounded-full text-sm font-medium text-muted hover:text-fg hover:bg-surface-2 transition-colors active:scale-95"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="w-full lg:w-auto px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-danger hover:opacity-90 shadow active:scale-95 transition"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
