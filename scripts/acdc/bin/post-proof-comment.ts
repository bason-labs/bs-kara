#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { buildProofOfWorkComment } from '../src/proofComment';

const prNumber = process.env.ACDC_PR_NUMBER;
if (!prNumber) {
  process.stderr.write('ACDC_PR_NUMBER not set; skipping proof-of-work comment.\n');
  process.exit(0);
}

const body = buildProofOfWorkComment({
  serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com',
  owner: process.env.GITHUB_REPOSITORY_OWNER ?? 'bason-labs',
  repo: (process.env.GITHUB_REPOSITORY ?? 'bason-labs/bs-kara').split('/')[1],
  runId: process.env.GITHUB_RUN_ID ?? '0',
  artifactName: 'playwright-report',
});

execFileSync('gh', ['pr', 'comment', prNumber, '--body', body], { stdio: 'inherit' });
