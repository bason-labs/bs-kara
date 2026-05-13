import { describe, it, expect } from 'vitest';
import { toE164VN, isE164VN } from './phone';

describe('toE164VN', () => {
  it('rewrites a valid 10-digit Vietnamese local number', () => {
    expect(toE164VN('0901234567')).toBe('+84901234567');
    expect(toE164VN('0123456789')).toBe('+84123456789');
  });

  it('trims surrounding whitespace', () => {
    expect(toE164VN(' 0901234567 ')).toBe('+84901234567');
    expect(toE164VN('\t0901234567\n')).toBe('+84901234567');
  });

  it('rejects raw E.164 input (the canonical form is the OUTPUT, not the input)', () => {
    expect(toE164VN('+84901234567')).toBeNull();
  });

  it('rejects numbers without the leading 0', () => {
    expect(toE164VN('84901234567')).toBeNull();
    expect(toE164VN('901234567')).toBeNull();
  });

  it('rejects wrong-length numbers', () => {
    expect(toE164VN('09012345')).toBeNull();
    expect(toE164VN('09012345678')).toBeNull();
  });

  it('rejects formatted numbers', () => {
    expect(toE164VN('0901-234-567')).toBeNull();
    expect(toE164VN('0901 234 567')).toBeNull();
    expect(toE164VN('(090) 123-4567')).toBeNull();
  });

  it('rejects empty and non-string inputs', () => {
    expect(toE164VN('')).toBeNull();
    expect(toE164VN(' ')).toBeNull();
    expect(toE164VN(null as unknown as string)).toBeNull();
    expect(toE164VN(undefined as unknown as string)).toBeNull();
    expect(toE164VN(901234567 as unknown as string)).toBeNull();
  });
});

describe('isE164VN', () => {
  it('accepts the canonical form', () => {
    expect(isE164VN('+84901234567')).toBe(true);
  });

  it('rejects local-format and other shapes', () => {
    expect(isE164VN('0901234567')).toBe(false);
    expect(isE164VN('+84 901 234 567')).toBe(false);
    expect(isE164VN('+8490123456')).toBe(false); // 8 digits after +84
    expect(isE164VN('+849012345678')).toBe(false); // 10 digits after +84
    expect(isE164VN('')).toBe(false);
    expect(isE164VN(null as unknown as string)).toBe(false);
  });
});
