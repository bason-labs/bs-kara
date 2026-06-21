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
