'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Shuffle, Palette, X, Hash, GripVertical, Mic, Sparkles, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Genre, RandomFilters, SingerType, Tone } from '@/lib/youtube';
import { ThemeToggle } from '../ThemeToggle';

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

// Keep in sync with the ALLOWED_VOICES whitelist in app/api/tts/route.ts.
const MC_VOICE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'vi-VN-Neural2-A', labelKey: 'settings.mcVoiceOptions.neural2A' },
  { value: 'vi-VN-Wavenet-C', labelKey: 'settings.mcVoiceOptions.wavenetC' },
  { value: 'vi-VN-Neural2-D', labelKey: 'settings.mcVoiceOptions.neural2D' },
  { value: 'vi-VN-Wavenet-B', labelKey: 'settings.mcVoiceOptions.wavenetB' },
];

const TYPE_OPTIONS: SingerType[] = ['all', 'solo', 'duet'];
const TONE_OPTIONS: Tone[] = ['all', 'male', 'female'];
const GENRE_OPTIONS: Genre[] = ['all', 'bolero', 'caco', 'tre'];

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

interface AutoRandomSectionProps {
  enabled: boolean;
  filters: RandomFilters;
  onToggle: (enabled: boolean) => void;
  onFiltersChange: (filters: Partial<RandomFilters>) => void;
}

function AutoRandomSection({
  enabled,
  filters,
  onToggle,
  onFiltersChange,
}: AutoRandomSectionProps) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="settings-autorandom">
      <SectionHeader
        id="settings-autorandom"
        Icon={Shuffle}
        title={t('settings.sections.autoRandom')}
      />

      <div
        className={`rounded-2xl border overflow-hidden transition-colors ${
          enabled
            ? 'border-glow/40 bg-gradient-to-b from-glow/10 to-surface/40 shadow-glow'
            : 'border-border bg-surface-2/40'
        }`}
      >
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          aria-pressed={enabled}
          aria-label={
            enabled
              ? t('autoRandom.toggleAriaOn')
              : t('autoRandom.toggleAriaOff')
          }
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left active:scale-[0.99] transition-transform"
        >
          <span className="flex flex-col min-w-0 pr-2">
            <span className="text-sm font-semibold text-fg leading-tight">
              {t('autoRandom.toggleLabel')}
            </span>
            <span
              className={`text-[11px] uppercase tracking-[0.18em] mt-1 ${
                enabled ? 'text-glow' : 'text-muted'
              }`}
            >
              {enabled ? t('autoRandom.onBadge') : t('autoRandom.offBadge')}
            </span>
          </span>

          <span
            aria-hidden
            className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
              enabled ? 'bg-gradient-brand' : 'bg-surface-2 border border-border'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </span>
        </button>

        <div
          className={`grid transition-all duration-300 ease-out ${
            enabled ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="px-4 pb-4 pt-2 space-y-4 border-t border-glow/20">
              <p className="text-xs leading-relaxed text-muted">
                {t('autoRandom.description')}
              </p>

              <FilterRow
                label={t('autoRandom.genreLabel')}
                value={filters.genre}
                options={GENRE_OPTIONS.map((v) => ({
                  value: v,
                  label: t(`autoRandom.genre.${v}`),
                }))}
                onChange={(v) => onFiltersChange({ genre: v as Genre })}
              />
              <FilterRow
                label={t('autoRandom.typeLabel')}
                value={filters.type}
                options={TYPE_OPTIONS.map((v) => ({
                  value: v,
                  label: t(`autoRandom.type.${v}`),
                }))}
                onChange={(v) => {
                  const next = v as SingerType;
                  // Duet typically pairs male+female voices, so a specific
                  // tone filter doesn't apply. Reset tone to "all" so the
                  // search keywords stay coherent.
                  if (next === 'duet') {
                    onFiltersChange({ type: next, tone: 'all' });
                  } else {
                    onFiltersChange({ type: next });
                  }
                }}
              />
              <FilterRow
                label={t('autoRandom.toneLabel')}
                value={filters.tone}
                options={TONE_OPTIONS.map((v) => ({
                  value: v,
                  label: t(`autoRandom.tone.${v}`),
                }))}
                onChange={(v) => onFiltersChange({ tone: v as Tone })}
                disabled={filters.type === 'duet'}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface QueueSectionProps {
  dragDropEnabled: boolean;
  onDragDropToggle: (enabled: boolean) => void;
  requesterPromptEnabled: boolean;
  onRequesterPromptToggle: (enabled: boolean) => void;
}

function QueueSection({
  dragDropEnabled,
  onDragDropToggle,
  requesterPromptEnabled,
  onRequesterPromptToggle,
}: QueueSectionProps) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="settings-queue" className="space-y-2">
      <SectionHeader
        id="settings-queue"
        Icon={GripVertical}
        title={t('settings.sections.queue')}
      />
      <ToggleRow
        label={t('settings.dragDropLabel')}
        hint={t('settings.dragDropHint')}
        enabled={dragDropEnabled}
        onToggle={onDragDropToggle}
      />
      <ToggleRow
        Icon={Mic}
        label={t('settings.requesterPromptLabel')}
        hint={t('settings.requesterPromptHint')}
        enabled={requesterPromptEnabled}
        onToggle={onRequesterPromptToggle}
      />
    </section>
  );
}

interface ToggleRowProps {
  label: string;
  hint: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  Icon?: typeof Shuffle;
}

function ToggleRow({ label, hint, enabled, onToggle, Icon }: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      aria-pressed={enabled}
      className="w-full flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2/40 p-4 text-left active:scale-[0.99] transition-transform hover:border-glow/30"
    >
      <span className="flex flex-col min-w-0 pr-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-fg leading-tight">
          {Icon && <Icon size={14} strokeWidth={2.2} className="text-muted" />}
          {label}
        </span>
        <span className="text-xs leading-relaxed text-muted mt-1">{hint}</span>
      </span>

      <span
        aria-hidden
        className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
          enabled ? 'bg-gradient-brand' : 'bg-surface-2 border border-border'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

interface AIMcSectionProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  mcVoice: string;
  onMcVoiceChange: (voice: string) => void;
}

function AIMcSection({
  enabled,
  onToggle,
  mcVoice,
  onMcVoiceChange,
}: AIMcSectionProps) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="settings-aimc" className="space-y-2">
      <SectionHeader
        id="settings-aimc"
        Icon={Sparkles}
        title={t('settings.sections.aiMc')}
      />
      <ToggleRow
        Icon={Sparkles}
        label={t('settings.aiMcLabel')}
        hint={t('settings.aiMcHint')}
        enabled={enabled}
        onToggle={onToggle}
      />
      {/* Animated reveal mirrors the auto-random sub-section pattern: the
          voice picker only matters when MC is on. */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          enabled ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="rounded-2xl border border-border bg-surface-2/40 p-4 mt-2 flex flex-col gap-2">
            <label
              htmlFor="settings-mc-voice"
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"
            >
              {t('settings.mcVoiceLabel')}
            </label>
            <CustomSelect
              id="settings-mc-voice"
              value={mcVoice}
              disabled={!enabled}
              options={MC_VOICE_OPTIONS.map((opt) => ({
                value: opt.value,
                label: t(opt.labelKey),
              }))}
              onChange={onMcVoiceChange}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ThemeSection() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="settings-appearance">
      <SectionHeader
        id="settings-appearance"
        Icon={Palette}
        title={t('settings.sections.appearance')}
      />
      <div className="rounded-2xl border border-border bg-surface-2/40 p-4 flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-muted pr-2 min-w-0">
          {t('settings.themeHint')}
        </p>
        <ThemeToggle />
      </div>
    </section>
  );
}

function RoomSection({ code }: { code: string }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="settings-room">
      <SectionHeader
        id="settings-room"
        Icon={Hash}
        title={t('settings.sections.room')}
      />
      <div className="rounded-2xl border border-border bg-surface-2/40 p-4 flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.22em] text-muted">
          {t('settings.roomCodeLabel')}
        </span>
        <span
          className="tabular px-3.5 py-1.5 text-sm font-bold text-white bg-gradient-brand rounded-full tracking-[0.3em] shadow-glow"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {code}
        </span>
      </div>
    </section>
  );
}

interface CustomSelectProps {
  id?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Custom popover dropdown — replaces the native <select> so the menu has the
// same surface/border styling as the rest of the sheet and isn't bound to
// the browser's chrome. Opens below by default and flips above when there
// isn't enough viewport room beneath the trigger.
interface MenuRect {
  left: number;
  top: number;
  width: number;
  placement: 'above' | 'below';
}

function CustomSelect({
  id,
  value,
  options,
  onChange,
  disabled,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<MenuRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const current = options.find((o) => o.value === value) ?? options[0];

  // Measure the trigger before paint and pick a placement. The menu is
  // portaled to the body to escape the sheet's overflow-hidden ancestors,
  // so we drive its position with fixed coordinates from the trigger rect.
  useLayoutEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    function measure() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const MENU_ESTIMATE = 280;
      const placement: 'above' | 'below' =
        spaceBelow < MENU_ESTIMATE && r.top > spaceBelow ? 'above' : 'below';
      setRect({
        left: r.left,
        top: placement === 'below' ? r.bottom + 8 : r.top - 8,
        width: r.width,
        placement,
      });
    }
    measure();
    // Reposition while open if anything resizes/scrolls (the sheet body is
    // a scroll container).
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 pr-10 text-sm text-fg text-left focus:outline-none focus:border-glow/60 active:scale-[0.99] transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown
          size={16}
          strokeWidth={2.2}
          aria-hidden
          className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        rect &&
        typeof window !== 'undefined' &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            aria-labelledby={id}
            style={{
              position: 'fixed',
              left: rect.left,
              top: rect.placement === 'below' ? rect.top : undefined,
              bottom:
                rect.placement === 'above'
                  ? window.innerHeight - rect.top
                  : undefined,
              width: rect.width,
            }}
            // z-index has to clear the SettingsSheet (z-40) and any sibling
            // overlays that might be above it.
            className="z-[70] rounded-xl border border-border bg-surface shadow-2xl overflow-hidden py-1"
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                      active
                        ? 'bg-gradient-brand text-white'
                        : 'text-fg hover:bg-surface-2'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {active && (
                      <Check size={14} strokeWidth={2.4} aria-hidden className="shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}

interface SectionHeaderProps {
  id: string;
  Icon: typeof Shuffle;
  title: string;
}

function SectionHeader({ id, Icon, title }: SectionHeaderProps) {
  return (
    <h3
      id={id}
      className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted mb-2.5 px-1"
    >
      <Icon size={13} strokeWidth={2.4} />
      {title}
    </h3>
  );
}

interface FilterRowProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

function FilterRow({
  label,
  value,
  options,
  onChange,
  disabled,
}: FilterRowProps) {
  return (
    <div
      className={`flex flex-col gap-2 transition-opacity ${
        disabled ? 'opacity-40 pointer-events-none' : ''
      }`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          // Active and inactive pills both carry a 1px border. The active
          // border is transparent so it occupies the same box as the
          // bordered inactive variant — switching selection no longer
          // shifts neighbouring pill positions.
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={disabled || undefined}
              onClick={() => onChange(opt.value)}
              className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide whitespace-nowrap border transition-colors active:scale-95 ${
                active
                  ? 'bg-gradient-brand text-white border-transparent shadow-glow'
                  : 'bg-surface text-muted border-border hover:text-fg hover:border-glow/40'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
