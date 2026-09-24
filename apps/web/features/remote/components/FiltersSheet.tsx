'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FILTER_GROUPS, type FilterChipId } from '@/lib/filters';

interface FiltersSheetProps {
  open: boolean;
  activeChips: Set<FilterChipId>;
  onApply: (chips: Set<FilterChipId>) => void;
  onClose: () => void;
}

export function FiltersSheet({
  open,
  activeChips,
  onApply,
  onClose,
}: FiltersSheetProps) {
  const { t } = useTranslation();

  const [visible, setVisible] = useState(false);
  // Draft chips — local to the sheet. Committed chips only update when the
  // user clicks Apply, so toggling chips inside the sheet never triggers a
  // search prematurely.
  const [draftChips, setDraftChips] = useState<Set<FilterChipId>>(
    () => new Set(activeChips),
  );

  // Always holds the latest committed chips without being a dep of the open
  // effect (adding activeChips to that dep would reset the draft on every
  // parent re-render while the sheet is already open). Written in an effect
  // (refs must not be mutated during render); the open-effect reads it inside
  // an effect, so it always sees the latest committed value.
  const committedRef = useRef(activeChips);
  useEffect(() => {
    committedRef.current = activeChips;
  });

  useEffect(() => {
    if (!open) return;
    // Initialise draft from committed state each time the sheet opens so the
    // user sees their previously-applied filters checked.
    setDraftChips(new Set(committedRef.current));
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

  const handleToggle = (id: FilterChipId) => {
    setDraftChips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReset = () => setDraftChips(new Set());

  const handleApply = () => {
    onApply(draftChips);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('search.filtersSheetTitle')}
      inert={!open}
      className={`fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center ${open ? '' : 'pointer-events-none'}`}
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label={t('search.filtersSheetTitle')}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Sheet (mobile) / Modal (desktop) */}
      <div
        className={`relative w-full bg-surface flex flex-col
          rounded-t-3xl border-t border-border max-h-[78%]
          lg:rounded-2xl lg:border lg:max-w-md lg:max-h-[80vh] lg:shadow-2xl
          transition-[transform,opacity] duration-300 ease-out
          ${visible
            ? 'translate-y-0 opacity-100 lg:scale-100'
            : 'translate-y-full opacity-0 lg:translate-y-0 lg:scale-95'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="lg:hidden mx-auto mt-1.5 w-11 h-[5px] rounded-full bg-border" aria-hidden />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-[family-name:var(--font-display)] text-[19px] font-semibold text-fg">
            {t('search.filtersSheetTitle')}
          </h2>
          <button
            type="button"
            onClick={handleReset}
            className="text-[13px] font-semibold text-muted px-2.5 py-2 rounded-lg hover:bg-surface-2 transition-colors"
          >
            {t('search.filtersReset')}
          </button>
        </div>

        {/* Scrollable filter groups */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4">
          {FILTER_GROUPS.map((group) => (
            <div key={group.key}>
              <p className="text-[12px] font-bold tracking-widest text-muted uppercase mb-2">
                {t(group.labelKey)}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.chips.map((chip) => {
                  const active = draftChips.has(chip.id);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleToggle(chip.id)}
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
            onClick={handleApply}
            className="w-full py-4 rounded-full bg-gradient-brand shadow-glow text-white font-[family-name:var(--font-display)] text-[15px] font-semibold"
          >
            {draftChips.size > 0
              ? t('search.filtersApply', { count: draftChips.size })
              : t('search.filtersViewAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
