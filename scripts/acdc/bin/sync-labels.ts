#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseLabels } from '../src/labels';

const repo = process.env.ACDC_REPO ?? 'bason-labs/bs-kara';
const raw = readFileSync(new URL('../../../.github/labels.json', import.meta.url), 'utf8');

for (const l of parseLabels(raw)) {
  execFileSync(
    'gh',
    ['label', 'create', l.name, '--color', l.color, '--description', l.description, '--force', '--repo', repo],
    { stdio: 'inherit' },
  );
}
