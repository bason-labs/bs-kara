'use client';

import { useTranslation } from 'react-i18next';
import {
  VERDICT_TABLE,
  type ScoreResult,
  type VerdictLocale,
} from '@/lib/scoring';

interface ScoreBlockProps {
  score: ScoreResult;
}

function pickVerdictLocale(lang: string): VerdictLocale {
  return lang.startsWith('en') ? 'en' : 'vi';
}

// Live outro score panel. Three layouts driven by score.state. Verdict
// text is read directly from VERDICT_TABLE — the table is the source of
// truth for tier copy; locales/{en,vi}.json carries only generic UI
// strings (zeroState / partialState / tierLabel).
export function ScoreBlock({ score }: ScoreBlockProps) {
  const { t, i18n } = useTranslation();

  if (score.state === 0) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="text-white/90 text-base md:text-xl font-medium"
      >
        {t('scoring.zeroState')}
      </p>
    );
  }

  if (score.state === 1) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="text-white/80 text-sm md:text-lg font-medium"
      >
        {t('scoring.partialState')}
      </p>
    );
  }

  const verdict = VERDICT_TABLE[score.tier][pickVerdictLocale(i18n.language)];
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${t('scoring.tierLabel')} ${score.tier} — ${score.value}`}
      className="flex flex-col items-center gap-1"
    >
      <div className="flex items-baseline gap-3">
        <span className="text-4xl md:text-6xl font-black text-white tabular-nums">
          {score.value}
        </span>
        <span className="text-xl md:text-3xl font-bold text-yellow-300">
          {score.tier}
        </span>
      </div>
      <p className="text-sm md:text-lg text-white/90 font-medium">{verdict}</p>
    </div>
  );
}
