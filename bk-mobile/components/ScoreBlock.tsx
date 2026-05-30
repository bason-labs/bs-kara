import type { ReactElement } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  VERDICT_TABLE,
  type ScoreResult,
  type VerdictLocale,
} from '@bs-kara/shared';

interface ScoreBlockProps {
  score: ScoreResult;
}

function pickVerdictLocale(lang: string): VerdictLocale {
  return lang.startsWith('en') ? 'en' : 'vi';
}

/**
 * Live outro score panel. Three layouts driven by score.state.
 * Verdict text is read directly from VERDICT_TABLE — the table is the source of
 * truth for tier copy; locales carry only generic UI strings.
 */
export function ScoreBlock({ score }: ScoreBlockProps): ReactElement | null {
  const { t, i18n } = useTranslation();

  if (score.state === 0) {
    return (
      <Text
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '500' }}
      >
        {t('scoring.zeroState')}
      </Text>
    );
  }

  if (score.state === 1) {
    return (
      <Text
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' }}
      >
        {t('scoring.partialState')}
      </Text>
    );
  }

  const verdict = VERDICT_TABLE[score.tier][pickVerdictLocale(i18n.language)];

  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${t('scoring.tierLabel')} ${score.tier} — ${score.value}`}
      style={{ alignItems: 'center', gap: 4 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
        <Text
          style={{
            fontSize: 48,
            fontWeight: '900',
            color: '#ffffff',
            fontVariant: ['tabular-nums'],
          }}
        >
          {score.value}
        </Text>
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: '#fde047',
            paddingBottom: 4,
          }}
        >
          {score.tier}
        </Text>
      </View>
      <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '500' }}>
        {verdict}
      </Text>
    </View>
  );
}
