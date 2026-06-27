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

// Precedence: inline override → a single `tier:*` label → default.
// Conflicting labels (more than one DISTINCT valid tier, e.g. tier:low + tier:high) are
// ambiguous capability/cost signals in the control plane, so we fall back to the default
// deterministically rather than routing on label-array order. Duplicates of one tier are fine.
export function resolveTier(
  inline: string | undefined,
  labels: string[] | undefined,
  def: Tier = 'medium',
): Tier {
  const fromInline = asTier(inline);
  if (fromInline) return fromInline;
  const fromLabels = new Set<Tier>();
  for (const l of labels ?? []) {
    if (l.startsWith('tier:')) {
      const t = asTier(l.slice('tier:'.length));
      if (t) fromLabels.add(t);
    }
  }
  return fromLabels.size === 1 ? [...fromLabels][0] : def;
}

export function modelForTier(tier: Tier, env: NodeJS.ProcessEnv = process.env): string {
  const override = env[`ACDC_TIER_${tier.toUpperCase()}`];
  return override && override.trim() ? override.trim() : TIER_MODEL[tier];
}
