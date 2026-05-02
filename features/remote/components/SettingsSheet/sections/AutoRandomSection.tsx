'use client';

import { Shuffle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Genre, RandomFilters, SingerType, Tone } from '@/lib/youtube/types';
import { SectionHeader } from '../primitives/SectionHeader';
import { FilterRow } from '../primitives/FilterRow';

const TYPE_OPTIONS: SingerType[] = ['all', 'solo', 'duet'];
const TONE_OPTIONS: Tone[] = ['all', 'male', 'female'];
const GENRE_OPTIONS: Genre[] = ['all', 'bolero', 'caco', 'tre'];

interface AutoRandomSectionProps {
  enabled: boolean;
  filters: RandomFilters;
  onToggle: (enabled: boolean) => void;
  onFiltersChange: (filters: Partial<RandomFilters>) => void;
}

export function AutoRandomSection({
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
