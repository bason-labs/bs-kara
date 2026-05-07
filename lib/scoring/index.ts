export {
  REACTION_WEIGHTS,
  INSUFFICIENT_SIGNAL_THRESHOLD,
  SCORE_SCALE,
  TIER_BREAKPOINTS,
  type Tier,
} from './weights';
export {
  computeScore,
  type ReactionInput,
  type ScoreInputs,
  type ScoreState,
  type ScoreResult,
  type ScoreRecord,
} from './computeScore';
export { VERDICT_TABLE, type VerdictLocale } from './verdictTable';
