import picomatch from 'picomatch';

export interface ScopeGateInput {
  /** Repo-relative paths changed by the PR. */
  changedPaths: string[];
  /** Glob patterns for the automation's own controls (hard-blocked). */
  protectedGlobs: string[];
  /** True if a human (CODEOWNER) approved the PR. */
  humanApproved: boolean;
  /**
   * Whether the hard gate applies to this PR. The gate exists to stop the AUTONOMOUS
   * worker (run/issue-* branches) from changing the control plane unsupervised; a
   * human-authored branch is the maintainer's own change and is allowed. Default true
   * (omitted = enforce) so the safe behavior is the fallback. See `isAgentBranch`.
   */
  enforced?: boolean;
  /** The ticket's area label, e.g. "area:web" (optional, advisory only). */
  areaLabel?: string;
  /** Map of area label -> allowed path globs (optional, advisory only). */
  areaGlobs?: Record<string, string[]>;
}

/**
 * True only for the autonomous worker's own branch (`run/issue-N`). Human-authored
 * branches (feat/*, fix/*, ...) return false — they are the maintainer's own changes.
 * The branch name is the only signal that distinguishes the two, since on a single host
 * the worker authors PRs as the maintainer's gh identity (see scripts/acdc/SECURITY.md).
 */
export function isAgentBranch(headRef: string): boolean {
  return /^run\/issue-\d+$/.test((headRef ?? '').trim());
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
  const enforced = input.enforced ?? true;

  // The hard gate only applies to enforced (agent) PRs that lack human approval.
  const hardViolations = !enforced || humanApproved
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
