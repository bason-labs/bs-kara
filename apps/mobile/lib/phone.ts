export function toE164VN(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!/^0\d{9}$/.test(trimmed)) return null;
  return '+84' + trimmed.slice(1);
}
