#!/usr/bin/env tsx
import { execSync } from 'node:child_process';
import { GREEN_BAR } from '../src/greenBar';

for (const step of GREEN_BAR) {
  process.stdout.write(`\n=== green bar: ${step.name} ===\n${step.cmd}\n`);
  execSync(step.cmd, { stdio: 'inherit' });
}
process.stdout.write('\n✅ green bar passed\n');
