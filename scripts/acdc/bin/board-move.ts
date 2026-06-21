#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { isBoardConfigured, readBoardConfig, itemEditArgs, type Status } from '../src/board';

const issue = process.env.ACDC_ISSUE;
const status = process.env.ACDC_STATUS as Status;

if (!isBoardConfigured(process.env)) {
  process.stderr.write('ACDC board not configured — skipping board move.\n');
  process.exit(0);
}

const cfg = readBoardConfig(process.env);
const itemId = execFileSync(
  'gh',
  [
    'project',
    'item-list',
    cfg.number,
    '--owner',
    cfg.owner,
    '--format',
    'json',
    '--jq',
    `.items[] | select(.content.number==${Number(issue)}) | .id`,
  ],
  { encoding: 'utf8' },
).trim();

if (!itemId) {
  process.stderr.write(`issue #${issue} not on the board — skipping.\n`);
  process.exit(0);
}

execFileSync('gh', itemEditArgs(cfg, itemId, status), { stdio: 'inherit' });
