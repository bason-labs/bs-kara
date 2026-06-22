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

// Match the EXACT authoritative identities — a broad `/coderabbit/i` substring test
// would let a spoofed login like "coderabbitai-evil" influence the gate. The
// `coderabbitai` handle and the `[bot]` suffix are reserved by GitHub, so an exact
// (case-insensitive) match cannot be impersonated.
const CODERABBIT_LOGINS = new Set(['coderabbitai[bot]', 'coderabbitai']);
const isCodeRabbit = (author: string): boolean => CODERABBIT_LOGINS.has(author.toLowerCase());
// Anchor to the start so "MySonar"/"Sonarish" can't masquerade as a Sonar check.
const isSonar = (name: string): boolean => /^sonar(cloud|qube)?\b/i.test(name);
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

/** `gh pr view --json reviews,statusCheckRollup` shape (the PR fields we read). */
export interface PrJson {
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

/**
 * Maps raw `gh pr view` output + the GATING ISSUE's labels to a MergeInput.
 * IMPORTANT: hasAutoMergeLabel comes from the ISSUE (the human's board ticket), NOT
 * the PR. The worker can label its own PR, so the PR's labels must never authorize a
 * merge; the issue's auto-merge label is the human's per-ticket authorization.
 */
export function buildMergeInput(pr: PrJson, issueLabels: string[]): MergeInput {
  const hasAutoMergeLabel = issueLabels.includes(AUTO_MERGE_LABEL);

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

/** Parse the issue number N from a `run/issue-N` head branch, else null. */
export function issueFromHeadRef(headRef: string): number | null {
  const m = /^run\/issue-(\d+)$/.exec((headRef ?? '').trim());
  return m ? Number(m[1]) : null;
}

/**
 * Strictly bind a PR to the issue that authorizes it. Returns the issue number ONLY
 * if the PR head is run/issue-N AND its closingIssuesReferences is exactly [N].
 * Fail-closed (null) on any mismatch/ambiguity, so a worker cannot point `Closes #M`
 * at someone else's auto-merge issue to hijack authorization.
 */
export function resolveGatingIssue(
  headRef: string,
  closingIssues: { number: number }[] | undefined,
): number | null {
  const n = issueFromHeadRef(headRef);
  if (n === null) return null;
  const numbers = (closingIssues ?? []).map((c) => c.number);
  if (numbers.length !== 1) return null;
  return numbers[0] === n ? n : null;
}

/**
 * True if a human applied the auto-merge label. `actors` MUST already be filtered to
 * human (User-type) accounts by the caller, so a non-User bot (a GitHub App / Action)
 * cannot authorize a merge. Returns false when no human applied it (fail-closed).
 */
export function appliedByHuman(actors: string[]): boolean {
  return actors.some((a) => a.trim() !== '');
}
