// PO-tunable scoring constants. Bump these instead of editing math elsewhere.

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';

// Per-emoji contribution to the weighted sum. Values picked so the
// production reaction set (lib/reactions.ts) reaches state 2 around
// 2-3 enthusiastic reactions and saturates near 10.
export const REACTION_WEIGHTS: Record<string, number> = {
  '🔥': 1.5,
  '💖': 1.2,
  '🥳': 1.1,
  '🎉': 1.0,
  '👏': 0.8,
};

// Below this weighted-sum value the score stays in "scoring in progress"
// mode (state 1). At or above, the live numeric value is shown (state 2).
// Compared against the weighted sum, NOT the raw count — a flurry of
// negative reactions can keep us in state 1 even with many reactions.
export const INSUFFICIENT_SIGNAL_THRESHOLD = 3;

// Multiplier applied to the weighted sum to produce a 0-100 value.
// Calibrated so a generous reaction set (~8-10 fire-tier reactions)
// lands at the top of the scale.
export const SCORE_SCALE = 8;

// value >= min promotes to that tier. Order matters: highest tier first
// so Array.find returns the strongest matching tier.
export const TIER_BREAKPOINTS: ReadonlyArray<{ tier: Tier; min: number }> = [
  { tier: 'S', min: 90 },
  { tier: 'A', min: 75 },
  { tier: 'B', min: 60 },
  { tier: 'C', min: 40 },
  { tier: 'D', min: 0 },
];
