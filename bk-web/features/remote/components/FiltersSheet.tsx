'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FILTER_GROUPS, type FilterChipId } from '@/lib/filters';

interface FiltersSheetProps {
  open: boolean;
  activeChips: Set<FilterChipId>;
  onToggle: (id: FilterChipId) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
}

export function FiltersSheet({
  open,
  activeChips,
  onToggle,
  onReset,
  onApply,
  onClose,
}: FiltersSheetProps) {
  const { t } = useTranslation();

  // Defer visible by one frame so slide-up animation has an off-screen
  // starting point even when the component mounts with open=true.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(id);
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
      aria-label={t('search.filtersSheetTitle')}
      inert={!open}
      className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label={t('settings.closeLabel')}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-surface rounded-t-3xl border-t border-border max-h-[78%] flex flex-col transition-transform duration-300 ease-out ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — decorative */}
        <div className="mx-auto mt-1.5 w-11 h-[5px] rounded-full bg-border" aria-hidden />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-[family-name:var(--font-display)] text-[19px] font-semibold text-fg">
            {t('search.filtersSheetTitle')}
          </h2>
          <button
            type="button"
            onClick={onReset}
            className="text-[13px] font-semibold text-muted px-2.5 py-2 rounded-lg hover:bg-surface-2 transition-colors"
          >
            Đặt lại
          </button>
        </div>

        {/* Scrollable filter groups */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {FILTER_GROUPS.map((group) => (
            <div key={group.key}>
              <p className="text-[12px] font-bold tracking-widest text-muted uppercase mb-2">
                {t(group.labelKey)}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.chips.map((chip) => {
                  const active = activeChips.has(chip.id);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onToggle(chip.id)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors min-h-[44px] flex items-center gap-1.5 ${
                        active
                          ? 'bg-gradient-brand text-white border-transparent shadow-glow'
                          : 'bg-surface text-muted border-border hover:text-fg hover:border-glow/40'
                      }`}
                    >
                      {active && <Check size={13} strokeWidth={3} />}
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="p-4 border-t border-border">
          <button
            type="button"
            onClick={() => {
              onApply();
              onClose();
            }}
            className="w-full py-4 rounded-full bg-gradient-brand shadow-glow text-white font-[family-name:var(--font-display)] text-[15px] font-semibold"
          >
            {activeChips.size > 0
              ? t('search.filtersApply', { count: activeChips.size })
              : t('search.filtersViewAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
