// NOTE: The ENFORCED scope gate is the inline bash check in .github/workflows/ci.yml
// (the `scope-gate` job). It HARD-BLOCKS protected control-path changes ONLY on the
// autonomous worker's own run/issue-* branches; human-authored branches (the
// maintainer's own changes) pass without a human-approved label. This module is the
// canonical protected list + the `isAgentBranch` classifier for local/runbook use, kept
// in sync with that inline check and .github/CODEOWNERS; it is not what gates CI.
import { evaluateScopeGate, isAgentBranch } from './scopeGate';

export const PROTECTED_GLOBS = [
  '.github/**',
  '.claude/**',
  'scripts/acdc/**',
  '.gitleaks.toml',
  '.coderabbit.yaml',
  'sonar-project.properties',
  'package.json',
  'turbo.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'database.rules.json',
  'bk-web/lib/firebase*',
  'bk-web/**/firebase*',
];

export const AREA_GLOBS: Record<string, string[]> = {
  'area:web': ['bk-web/**', 'e2e/**', 'playwright.config.ts'],
  'area:mobile': ['bk-mobile/**', 'bk-mobile-ui/**'],
  'area:shared': ['bk-shared/**'],
  'area:e2e': ['e2e/**', 'playwright.config.ts'],
  'area:infra': ['.github/**', 'scripts/acdc/**', 'turbo.json'],
};

export interface RunScopeGateOptions {
  changedPaths: string[];
  humanApproved: boolean;
  areaLabel?: string;
  /** The PR head branch. When given, the hard gate enforces only on agent (run/issue-*)
   * branches; human-authored branches pass. Omitted → enforce (safe default). */
  headRef?: string;
}

/** Splits `git diff --name-only` output into trimmed, non-empty paths. */
export function parseChangedPaths(gitOutput: string): string[] {
  return gitOutput.split('\n').map((s) => s.trim()).filter(Boolean);
}

/** Returns a process exit code (0 = pass, 1 = hard violation). */
export function runScopeGate(opts: RunScopeGateOptions, log: (msg: string) => void): number {
  // No headRef → enforce (safe default). With a headRef, enforce only on agent branches.
  const enforced = opts.headRef === undefined ? true : isAgentBranch(opts.headRef);
  const result = evaluateScopeGate({
    changedPaths: opts.changedPaths,
    protectedGlobs: PROTECTED_GLOBS,
    humanApproved: opts.humanApproved,
    enforced,
    areaLabel: opts.areaLabel,
    areaGlobs: AREA_GLOBS,
  });
  if (result.unknownArea) {
    log(`::warning::unknown area label: ${opts.areaLabel} — skipping out-of-area check`);
  }
  for (const warning of result.advisoryWarnings) log(`::warning::out-of-area change: ${warning}`);
  if (!result.pass) {
    log('::error::scope-gate failed — PR touches protected automation controls without human approval:');
    for (const violation of result.hardViolations) log(`::error::  ${violation}`);
    log('Add a CODEOWNER approval to override, or remove these changes.');
  }
  return result.pass ? 0 : 1;
}
