import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLabels, AREA_LABEL_NAMES, TIER_LABEL_NAMES } from './labels';

const raw = readFileSync(new URL('../../../.github/labels.json', import.meta.url), 'utf8');

describe('labels.json', () => {
  it('parses into well-formed label objects', () => {
    const labels = parseLabels(raw);
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) {
      expect(l.name).toBeTruthy();
      expect(l.color).toMatch(/^[0-9a-f]{6}$/);
      expect(l.description).toBeTruthy();
    }
  });

  it('contains every required area label exactly once', () => {
    const labels = parseLabels(raw);
    const names = labels.map((l) => l.name);
    for (const a of AREA_LABEL_NAMES) {
      expect(names.filter((n) => n === a)).toHaveLength(1);
    }
  });

  it('contains the governance labels the runbook depends on', () => {
    const names = parseLabels(raw).map((l) => l.name);
    for (const n of ['agent-ready', 'needs-human', 'blocked', 'auto-merge', 'human-approved']) {
      expect(names).toContain(n);
    }
  });

  it('contains every tier label exactly once', () => {
    const names = parseLabels(raw).map((l) => l.name);
    for (const t of TIER_LABEL_NAMES) {
      expect(names.filter((n) => n === t)).toHaveLength(1);
    }
  });
});
