export type Tier = 'low' | 'medium' | 'high';

const TIERS: readonly Tier[] = ['low', 'medium', 'high'];

// Tier → Claude `--model` value. Aliases (haiku/sonnet/opus) resolve to the current
// model of that family; override per-tier with ACDC_TIER_LOW|MEDIUM|HIGH to pin full ids.
export const TIER_MODEL: Record<Tier, string> = {
  low: 'haiku',
  medium: 'sonnet',
  high: 'opus',
};

function asTier(v: string | undefined): Tier | undefined {
  return v !== undefined && (TIERS as readonly string[]).includes(v) ? (v as Tier) : undefined;
}

// Validate a free-form string into a Tier, falling back to `def`.
export function coerceTier(v: string | undefined, def: Tier): Tier {
  return asTier(v) ?? def;
}

// Precedence: inline override → first `tier:*` label → default.
export function resolveTier(
  inline: string | undefined,
  labels: string[] | undefined,
  def: Tier = 'medium',
): Tier {
  const fromInline = asTier(inline);
  if (fromInline) return fromInline;
  for (const l of labels ?? []) {
    if (l.startsWith('tier:')) {
      const t = asTier(l.slice('tier:'.length));
      if (t) return t;
    }
  }
  return def;
}

export function modelForTier(tier: Tier, env: NodeJS.ProcessEnv = process.env): string {
  const override = env[`ACDC_TIER_${tier.toUpperCase()}`];
  return override && override.trim() ? override.trim() : TIER_MODEL[tier];
}
