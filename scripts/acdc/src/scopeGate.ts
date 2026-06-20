import picomatch from 'picomatch';

export interface ScopeGateInput {
  /** Repo-relative paths changed by the PR. */
  changedPaths: string[];
  /** Glob patterns for the automation's own controls (hard-blocked). */
  protectedGlobs: string[];
  /** True if a human (CODEOWNER) approved the PR. */
  humanApproved: boolean;
  /** The ticket's area label, e.g. "area:web" (optional, advisory only). */
  areaLabel?: string;
  /** Map of area label -> allowed path globs (optional, advisory only). */
  areaGlobs?: Record<string, string[]>;
}

export interface ScopeGateResult {
  /** Protected paths touched without human approval. */
  hardViolations: string[];
  /** Paths outside the declared area (advisory). */
  advisoryWarnings: string[];
  /** True when there are no hard violations. */
  pass: boolean;
}

function anyMatch(path: string, globs: string[]): boolean {
  return globs.some((g) => picomatch.isMatch(path, g, { dot: true }));
}

export function evaluateScopeGate(input: ScopeGateInput): ScopeGateResult {
  const { changedPaths, protectedGlobs, humanApproved, areaLabel, areaGlobs } = input;

  const hardViolations = humanApproved
    ? []
    : changedPaths.filter((p) => anyMatch(p, protectedGlobs));

  let advisoryWarnings: string[] = [];
  if (areaLabel && areaGlobs && areaGlobs[areaLabel] && areaLabel !== 'area:multiple') {
    const allowed = areaGlobs[areaLabel];
    advisoryWarnings = changedPaths.filter(
      (p) => !anyMatch(p, allowed) && !anyMatch(p, protectedGlobs),
    );
  }

  return { hardViolations, advisoryWarnings, pass: hardViolations.length === 0 };
}
