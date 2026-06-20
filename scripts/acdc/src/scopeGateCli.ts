import { evaluateScopeGate } from './scopeGate';

export const PROTECTED_GLOBS = [
  '.github/**',
  '.claude/**',
  'scripts/acdc/**',
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

/** Returns a process exit code (0 = pass, 1 = hard violation). */
export function runScopeGate(opts: RunScopeGateOptions, log: (msg: string) => void): number {
  const r = evaluateScopeGate({
    changedPaths: opts.changedPaths,
    protectedGlobs: PROTECTED_GLOBS,
    humanApproved: opts.humanApproved,
    areaLabel: opts.areaLabel,
    areaGlobs: AREA_GLOBS,
  });
  for (const w of r.advisoryWarnings) log(`::warning::out-of-area change: ${w}`);
  if (!r.pass) {
    log('::error::scope-gate failed — PR touches protected automation controls without human approval:');
    for (const v of r.hardViolations) log(`::error::  ${v}`);
    log('Add a CODEOWNER approval to override, or remove these changes.');
  }
  return r.pass ? 0 : 1;
}
