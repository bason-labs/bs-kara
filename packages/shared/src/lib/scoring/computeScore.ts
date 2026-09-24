import {
  INSUFFICIENT_SIGNAL_THRESHOLD,
  REACTION_WEIGHTS,
  SCORE_SCALE,
  TIER_BREAKPOINTS,
  type Tier,
} from './weights';
import { VERDICT_TABLE, type VerdictLocale } from './verdictTable';

export interface ReactionInput {
  emoji: string;
}

export interface ScoreInputs {
  reactions: ReactionInput[];
  // When provided, `verdict` in the result is the localized phrase from
  // VERDICT_TABLE. When omitted, `verdict` is the tier letter — the caller
  // resolves the phrase itself. Tests use the omitted form to keep
  // assertions locale-free.
  locale?: VerdictLocale;
  // Defaults to REACTION_WEIGHTS. Overridden by tests / future experiments.
  // Not persisted (see ScoreRecord narrowing below).
  weights?: Record<string, number>;
}

export type ScoreState = 0 | 1 | 2;

export interface ScoreResult {
  value: number;
  tier: Tier;
  verdict: string;
  state: ScoreState;
}

// Persisted form. `inputs` is narrowed to drop the test-only `weights`
// override and the locale flag (the resolved verdict is already on the
// parent record), so a Firebase round-trip stores only the raw reaction
// list — enough to recompute or audit the score later.
export interface ScoreRecord {
  value: number;
  tier: Tier;
  verdict: string;
  inputs: { reactions: ReactionInput[] };
  isRelative: boolean;
  source: 'static';
}

export function computeScore(inputs: ScoreInputs): ScoreResult {
  const weights = inputs.weights ?? REACTION_WEIGHTS;
  const sum = inputs.reactions.reduce(
    (acc, r) => acc + (weights[r.emoji] ?? 0),
    0,
  );

  // State 0 is decoupled from `sum`: a negative-weighted reaction must
  // not collapse the display back to "no reactions yet".
  if (inputs.reactions.length === 0) {
    return { value: 0, tier: 'D', verdict: '', state: 0 };
  }

  if (sum < INSUFFICIENT_SIGNAL_THRESHOLD) {
    return { value: 0, tier: 'D', verdict: '', state: 1 };
  }

  const value = Math.max(0, Math.min(100, Math.round(sum * SCORE_SCALE)));
  const tier =
    TIER_BREAKPOINTS.find((b) => value >= b.min)?.tier ?? 'D';
  const verdict = inputs.locale ? VERDICT_TABLE[tier][inputs.locale] : tier;
  return { value, tier, verdict, state: 2 };
}
