#!/usr/bin/env tsx
// The ONE sanctioned label mutation a worker may perform: flag an issue for a human.
// The worker is denied `gh issue edit --add-label` directly (so it cannot apply
// auto-merge / human-approved); it escalates through this narrow wrapper instead.
// Usage: ACDC_ISSUE=<n> pnpm -C scripts/acdc exec tsx bin/escalate-needs-human.ts
//    or: pnpm -C scripts/acdc exec tsx bin/escalate-needs-human.ts <n> ["reason"]
import { execFileSync } from 'node:child_process';

const issue = process.argv[2] || process.env.ACDC_ISSUE;
if (!issue || !/^\d+$/.test(issue)) {
  process.stderr.write('escalate-needs-human: pass a numeric issue number as argv[1] or ACDC_ISSUE.\n');
  process.exit(1);
}
const reason = process.argv[3];

execFileSync('gh', ['issue', 'edit', issue, '--add-label', 'needs-human'], { stdio: 'inherit' });
if (reason) {
  execFileSync('gh', ['issue', 'comment', issue, '--body', `Escalated to needs-human: ${reason}`], {
    stdio: 'inherit',
  });
}
