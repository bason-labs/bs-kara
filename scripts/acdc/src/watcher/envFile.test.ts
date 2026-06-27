import { describe, it, expect } from 'vitest';
import { parseEnvFile } from './envFile';

describe('parseEnvFile', () => {
  it('parses KEY=VALUE lines, skipping blanks and comments', () => {
    expect(parseEnvFile('A=1\n\n# c\nB=two\n')).toEqual({ A: '1', B: 'two' });
  });
  it('strips matching single or double quotes', () => {
    expect(parseEnvFile('A="x"\nB=\'y\'')).toEqual({ A: 'x', B: 'y' });
  });
  it('keeps = signs in the value', () => {
    expect(parseEnvFile('TOKEN=ab=cd')).toEqual({ TOKEN: 'ab=cd' });
  });
});
