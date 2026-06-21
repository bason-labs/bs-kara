import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AREA_LABEL_NAMES } from './labels';

const yml = readFileSync(new URL('../../../.github/ISSUE_TEMPLATE/agent_task.yml', import.meta.url), 'utf8');

describe('agent_task template Area options match area:* labels', () => {
  it('every dropdown option has a matching area:<option> label and vice versa', () => {
    const optionsBlock = yml.slice(yml.indexOf('options:'));
    const options = [...optionsBlock.matchAll(/^\s+-\s+(web|mobile|shared|e2e|infra|multiple)\s*$/gm)].map(
      (m) => m[1],
    );
    const fromTemplate = new Set(options.map((o) => `area:${o}`));
    const fromLabels = new Set(AREA_LABEL_NAMES);
    expect([...fromTemplate].sort()).toEqual([...fromLabels].sort());
  });
});
