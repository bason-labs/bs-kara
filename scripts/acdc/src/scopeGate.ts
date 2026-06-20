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
  hardViolations: string[];
  advisoryWarnings: string[];
  /** True when an area label was given but is not recognized (and not 'area:multiple'). */
  unknownArea: boolean;
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
  let unknownArea = false;
  if (areaLabel && areaLabel !== 'area:multiple' && areaGlobs) {
    const allowed = areaGlobs[areaLabel];
    if (allowed) {
      advisoryWarnings = changedPaths.filter(
        (p) => !anyMatch(p, allowed) && !anyMatch(p, protectedGlobs),
      );
    } else {
      unknownArea = true;
    }
  }

  return { hardViolations, advisoryWarnings, unknownArea, pass: hardViolations.length === 0 };
}
