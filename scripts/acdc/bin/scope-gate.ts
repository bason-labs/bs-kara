#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { runScopeGate, parseChangedPaths } from '../src/scopeGateCli';

function changedPathsFromGit(baseRef: string): string[] {
  const out = execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
    encoding: 'utf8',
  });
  return parseChangedPaths(out);
}

const baseRef = process.env.ACDC_BASE_REF ?? 'origin/main';
const humanApproved = process.env.ACDC_HUMAN_APPROVED === 'true';
const areaLabel = process.env.ACDC_AREA_LABEL || undefined;
// GITHUB_HEAD_REF is set in PR workflows; ACDC_HEAD_REF lets the runbook pass it locally.
const headRef = process.env.GITHUB_HEAD_REF || process.env.ACDC_HEAD_REF || undefined;

const code = runScopeGate(
  { changedPaths: changedPathsFromGit(baseRef), humanApproved, areaLabel, headRef },
  (m) => process.stdout.write(m + '\n'),
);
process.exit(code);
