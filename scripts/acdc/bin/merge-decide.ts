#!/usr/bin/env tsx
// Deterministic merge decision for an ACDC PR. Reads the PR's labels, reviews, and
// check rollup via `gh`, derives the independent-gate signal from CodeRabbit's review
// STATE (+ any SonarCloud check), and runs decideMerge. Prints a JSON decision.
// Exit 0 = decided merge:true; exit 2 = decided merge:false; exit 1 = error.
//
// Usage: ACDC_PR=<pr> pnpm -C scripts/acdc exec tsx bin/merge-decide.ts
//    or: pnpm -C scripts/acdc exec tsx bin/merge-decide.ts <pr>
import { execFileSync } from 'node:child_process';
import { buildMergeInput, decideMerge, computeIndependentGate, type PrJson } from '../src/mergeDecision';

const pr = process.argv[2] || process.env.ACDC_PR;
if (!pr) {
  process.stderr.write('merge-decide: pass a PR number as argv[1] or ACDC_PR.\n');
  process.exit(1);
}

let raw: string;
try {
  raw = execFileSync(
    'gh',
    ['pr', 'view', pr, '--json', 'labels,reviews,statusCheckRollup'],
    { encoding: 'utf8' },
  );
} catch (err) {
  process.stderr.write(`merge-decide: gh pr view failed: ${(err as Error).message}\n`);
  process.exit(1);
}

let json: PrJson;
try {
  json = JSON.parse(raw) as PrJson;
} catch (err) {
  process.stderr.write(`merge-decide: could not parse gh output: ${(err as Error).message}\n`);
  process.exit(1);
}

const input = buildMergeInput(json);
const decision = decideMerge(input);
const gate = computeIndependentGate({
  reviews: (json.reviews ?? []).map((r) => ({ author: r.author?.login ?? '', state: r.state ?? '' })),
  checks: (json.statusCheckRollup ?? []).map((e) => ({
    name: e.name ?? e.context ?? '?',
    conclusion: String(e.conclusion ?? e.state ?? ''),
  })),
});

process.stdout.write(`${JSON.stringify({ pr, ...decision, input, gate: gate.detail }, null, 2)}\n`);
process.exit(decision.merge ? 0 : 2);
