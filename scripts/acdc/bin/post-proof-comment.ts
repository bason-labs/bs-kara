#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { buildProofOfWorkComment, parseProofCommentEnv } from '../src/proofComment';

const prNumber = process.env.ACDC_PR_NUMBER;
if (!prNumber) {
  process.stderr.write('ACDC_PR_NUMBER not set; skipping proof-of-work comment.\n');
  process.exit(0);
}

let body: string;
try {
  body = buildProofOfWorkComment(parseProofCommentEnv(process.env));
} catch (err) {
  process.stderr.write(`${(err as Error).message}\n`);
  process.exit(1);
}

execFileSync('gh', ['pr', 'comment', prNumber, '--body', body], { stdio: 'inherit' });
