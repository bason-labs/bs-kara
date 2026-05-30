import { View, Text, Switch, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';
import { FilterChipRow } from '../primitives/FilterChipRow';
import { SectionLabel } from '../primitives/SectionLabel';
import type { Genre, SingerType, Tone } from '@bs-kara/shared';

type RandomFilters = { genre: Genre; type: SingerType; tone: Tone };

const TYPE_OPTIONS: { value: SingerType; labelKey: string }[] = [
  { value: 'all', labelKey: 'autoRandom.type.all' },
  { value: 'solo', labelKey: 'autoRandom.type.solo' },
  { value: 'duet', labelKey: 'autoRandom.type.duet' },
];
const TONE_OPTIONS: { value: Tone; labelKey: string }[] = [
  { value: 'all', labelKey: 'autoRandom.tone.all' },
  { value: 'male', labelKey: 'autoRandom.tone.male' },
  { value: 'female', labelKey: 'autoRandom.tone.female' },
];
const GENRE_OPTIONS: { value: Genre; labelKey: string }[] = [
  { value: 'all', labelKey: 'autoRandom.genre.all' },
  { value: 'bolero', labelKey: 'autoRandom.genre.bolero' },
  { value: 'caco', labelKey: 'autoRandom.genre.caco' },
  { value: 'tre', labelKey: 'autoRandom.genre.tre' },
];

interface AutoRandomSectionProps {
  isAutoRandomMode: boolean;
  randomFilters: RandomFilters;
  onAutoRandomChange: (v: boolean) => void;
  onFilterChange: (f: Partial<RandomFilters>) => void;
}

export function AutoRandomSection({
  isAutoRandomMode,
  randomFilters,
  onAutoRandomChange,
  onFilterChange,
}: AutoRandomSectionProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;

  return (
    <>
      <SectionLabel label={t('settings.sections.autoRandom')} />
      <View
        style={{
          backgroundColor: isAutoRandomMode
            ? 'rgba(0,139,139,0.08)'
            : c.surface2,
          borderWidth: 1,
          borderColor: isAutoRandomMode ? 'rgba(0,139,139,0.4)' : c.border,
          borderRadius: 16,
          marginHorizontal: 12,
          marginBottom: 4,
          overflow: 'hidden',
        }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onAutoRandomChange(!isAutoRandomMode)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: c.fg, fontSize: 14, fontWeight: '600' }}>
              {t('autoRandom.toggleLabel')}
            </Text>
            <Text
              style={{
                color: isAutoRandomMode ? c.accent : c.muted,
                fontSize: 10,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 3,
                marginTop: 4,
              }}
            >
              {isAutoRandomMode ? t('autoRandom.onBadge') : t('autoRandom.offBadge')}
            </Text>
          </View>
          <Switch
            value={isAutoRandomMode}
            onValueChange={onAutoRandomChange}
            trackColor={{ false: c.border, true: c.brand }}
            thumbColor={c.fg}
          />
        </TouchableOpacity>

        {isAutoRandomMode && (
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 16,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: 'rgba(0,139,139,0.2)',
            }}
          >
            <Text style={{ color: c.muted, fontSize: 12, marginBottom: 16 }}>
              {t('autoRandom.description')}
            </Text>
            <FilterChipRow
              label={t('autoRandom.genreLabel')}
              value={randomFilters.genre}
              options={GENRE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              onChange={(v) => onFilterChange({ genre: v as Genre })}
            />
            <FilterChipRow
              label={t('autoRandom.typeLabel')}
              value={randomFilters.type}
              options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              onChange={(v) => {
                const next = v as SingerType;
                if (next === 'duet') onFilterChange({ type: next, tone: 'all' });
                else onFilterChange({ type: next });
              }}
            />
            <FilterChipRow
              label={t('autoRandom.toneLabel')}
              value={randomFilters.tone}
              options={TONE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              onChange={(v) => onFilterChange({ tone: v as Tone })}
              disabled={randomFilters.type === 'duet'}
            />
          </View>
        )}
      </View>
    </>
  );
}
