export interface MergeInput {
  hasAutoMergeLabel: boolean;
  requiredChecksPass: boolean;
  independentGatePass: boolean;
  blockingFindings: number;
  dismissedBlockingFindings: number;
}

export interface MergeResult {
  merge: boolean;
  reason: string;
}

export function decideMerge(i: MergeInput): MergeResult {
  if (!i.hasAutoMergeLabel) return { merge: false, reason: 'no auto-merge label — open PR and stop' };
  if (!i.requiredChecksPass) return { merge: false, reason: 'required CI checks not all green' };
  if (!i.independentGatePass)
    return { merge: false, reason: 'no independent (non-Claude) gate passed — refuse merge-by-absence' };
  if (i.blockingFindings > 0)
    return { merge: false, reason: `${i.blockingFindings} unresolved blocking finding(s)` };
  if (i.dismissedBlockingFindings > 0)
    return { merge: false, reason: 'a blocking finding was dismissed not fixed — needs human' };
  return { merge: true, reason: 'all positive gate signals present' };
}

// --- Independent gate: turn CodeRabbit / SonarCloud signals into the booleans
// decideMerge consumes, so the merge decision is read from real PR state instead
// of being a hand-fed judgment call. ---

/** A PR review reduced to the only two fields the gate cares about. */
export interface ReviewSignal {
  author: string;
  /** APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED (GitHub review state). */
  state: string;
}

/** A status check / check-run reduced to name + conclusion. */
export interface CheckSignal {
  name: string;
  /** SUCCESS | FAILURE | NEUTRAL | SKIPPED | PENDING | '' (GitHub conclusion/state). */
  conclusion: string;
}

export interface IndependentGateInput {
  reviews: ReviewSignal[];
  checks: CheckSignal[];
}

export interface IndependentGateResult {
  independentGatePass: boolean;
  blockingFindings: number;
  dismissedBlockingFindings: number;
  detail: string;
}

const isCodeRabbit = (author: string): boolean => /coderabbit/i.test(author);
const isSonar = (name: string): boolean => /sonar/i.test(name);
const GREEN = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);
const RED = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'ERROR']);

/**
 * Derives the independent-gate booleans from CodeRabbit's review STATE and any
 * SonarCloud check. The independent gate PASSES only when at least one non-Claude
 * gate gave a positive signal (CodeRabbit APPROVED, or a green Sonar check) AND no
 * present independent gate is in a blocking state. A CodeRabbit review that is only
 * COMMENTED (or absent) is NOT a pass — that is the "refuse merge-by-absence" rule.
 * `request_changes_workflow: true` in .coderabbit.yaml is what makes CodeRabbit emit
 * APPROVED / CHANGES_REQUESTED rather than only COMMENTED.
 */
export function computeIndependentGate(input: IndependentGateInput): IndependentGateResult {
  const crReviews = input.reviews.filter((r) => isCodeRabbit(r.author));
  const crState = crReviews.length
    ? crReviews[crReviews.length - 1].state.toUpperCase()
    : 'NONE';
  const crApproved = crState === 'APPROVED';
  const crChangesRequested = crState === 'CHANGES_REQUESTED';

  const sonarChecks = input.checks.filter((c) => isSonar(c.name));
  const sonarPass = sonarChecks.some((c) => GREEN.has(c.conclusion.toUpperCase()));
  const sonarFail = sonarChecks.some((c) => RED.has(c.conclusion.toUpperCase()));

  const anyPass = crApproved || sonarPass;
  const blockingFindings = (crChangesRequested ? 1 : 0) + (sonarFail ? 1 : 0);
  const independentGatePass = anyPass && blockingFindings === 0;

  const detail =
    `CodeRabbit=${crState}` +
    (sonarChecks.length ? `, Sonar=${sonarPass ? 'pass' : sonarFail ? 'fail' : 'pending'}` : ', Sonar=absent');

  // A deterministic read cannot tell a fixed-and-resolved finding from one a human
  // dismissed without fixing, so this stays 0 here; a human can still override.
  return { independentGatePass, blockingFindings, dismissedBlockingFindings: 0, detail };
}

/** `gh pr view --json labels,reviews,statusCheckRollup` shape (the fields we read). */
export interface PrJson {
  labels?: { name: string }[];
  reviews?: { author?: { login?: string }; state?: string }[];
  // statusCheckRollup mixes CheckRun ({name,status,conclusion}) and StatusContext
  // ({context,state}); we normalise both.
  statusCheckRollup?: {
    name?: string;
    context?: string;
    conclusion?: string;
    state?: string;
    status?: string;
  }[];
}

const AUTO_MERGE_LABEL = 'auto-merge';

/** Maps raw `gh pr view --json ...` output to a MergeInput ready for decideMerge. */
export function buildMergeInput(pr: PrJson): MergeInput {
  const labels = (pr.labels ?? []).map((l) => l.name);
  const hasAutoMergeLabel = labels.includes(AUTO_MERGE_LABEL);

  const rollup = (pr.statusCheckRollup ?? []).map((e) => ({
    name: e.name ?? e.context ?? '?',
    conclusion: String(e.conclusion ?? e.state ?? ''),
  }));
  // Conservative: every check must be green. A pending or red check blocks the merge.
  const requiredChecksPass =
    rollup.length > 0 && rollup.every((c) => GREEN.has(c.conclusion.toUpperCase()));

  const reviews: ReviewSignal[] = (pr.reviews ?? []).map((r) => ({
    author: r.author?.login ?? '',
    state: r.state ?? '',
  }));

  const gate = computeIndependentGate({ reviews, checks: rollup });

  return {
    hasAutoMergeLabel,
    requiredChecksPass,
    independentGatePass: gate.independentGatePass,
    blockingFindings: gate.blockingFindings,
    dismissedBlockingFindings: gate.dismissedBlockingFindings,
  };
}
