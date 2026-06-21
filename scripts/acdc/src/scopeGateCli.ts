// NOTE: The ENFORCED scope gate is the inline, base-controlled bash check in
// .github/workflows/ci.yml (the `scope-gate` job). On a pull_request event GitHub
// runs the BASE branch's workflow YAML, so a PR cannot tamper with the gate that
// judges it. This module is the canonical protected list for local/runbook use and
// is kept in sync with that inline check (and .github/CODEOWNERS); it is not what
// gates CI.
import { evaluateScopeGate } from './scopeGate';

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
}

/** Splits `git diff --name-only` output into trimmed, non-empty paths. */
export function parseChangedPaths(gitOutput: string): string[] {
  return gitOutput.split('\n').map((s) => s.trim()).filter(Boolean);
}

/** Returns a process exit code (0 = pass, 1 = hard violation). */
export function runScopeGate(opts: RunScopeGateOptions, log: (msg: string) => void): number {
  const result = evaluateScopeGate({
    changedPaths: opts.changedPaths,
    protectedGlobs: PROTECTED_GLOBS,
    humanApproved: opts.humanApproved,
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
