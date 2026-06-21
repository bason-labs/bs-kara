import { describe, it, expect } from 'vitest';
import { isBoardConfigured, readBoardConfig, itemEditArgs, type BoardConfig } from './board';

const FULL_ENV: NodeJS.ProcessEnv = {
  ACDC_PROJECT_OWNER: 'thienba',
  ACDC_PROJECT_NUMBER: '7',
  ACDC_PROJECT_ID: 'PVT_123',
  ACDC_STATUS_FIELD_ID: 'FIELD_abc',
  ACDC_STATUS_TODO: 'opt-todo',
  ACDC_STATUS_IN_PROGRESS: 'opt-inprogress',
  ACDC_STATUS_IN_REVIEW: 'opt-inreview',
  ACDC_STATUS_DONE: 'opt-done',
};

describe('isBoardConfigured', () => {
  it('is false when a required env var is missing', () => {
    const env = { ...FULL_ENV };
    delete env.ACDC_STATUS_FIELD_ID;
    expect(isBoardConfigured(env)).toBe(false);
  });
  it('is true when all required env vars are present', () => {
    expect(isBoardConfigured(FULL_ENV)).toBe(true);
  });
});

describe('readBoardConfig', () => {
  it('throws when the board is not configured', () => {
    expect(() => readBoardConfig({})).toThrow(/not configured/i);
  });
});

describe('itemEditArgs', () => {
  const cfg: BoardConfig = readBoardConfig(FULL_ENV);

  it('maps the status to its single-select option id', () => {
    const args = itemEditArgs(cfg, 'item-1', 'In review');
    const idx = args.indexOf('--single-select-option-id');
    expect(idx).toBeGreaterThan(-1);
    expect(args[idx + 1]).toBe('opt-inreview');
  });

  it('includes the status field id', () => {
    const args = itemEditArgs(cfg, 'item-1', 'Done');
    const idx = args.indexOf('--field-id');
    expect(idx).toBeGreaterThan(-1);
    expect(args[idx + 1]).toBe('FIELD_abc');
  });

  it('throws on an unknown status', () => {
    // @ts-expect-error exercising the runtime guard with an invalid status
    expect(() => itemEditArgs(cfg, 'item-1', 'Bogus')).toThrow(/unknown status/i);
  });
});
