// VN-only phone canonicaliser. The locked decision is to accept ONLY
// Vietnamese local-format numbers (10 digits starting with 0) and rewrite
// to E.164 (+84 + last 9 digits). Anything else — raw +84..., 84..., bare
// 9-digit, hyphens, whitespace inside the digits, international numbers —
// is rejected. Storage and wire format is always +84XXXXXXXXX.

export function toE164VN(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!/^0\d{9}$/.test(trimmed)) return null;
  return '+84' + trimmed.slice(1);
}

export function isE164VN(s: unknown): boolean {
  return typeof s === 'string' && /^\+84\d{9}$/.test(s);
}
