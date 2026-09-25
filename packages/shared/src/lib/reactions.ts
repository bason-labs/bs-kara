export const REACTIONS = ['💖', '🔥', '🎉', '👏', '🥳'] as const;

export function getGifUrl(emoji: string): string {
  const cp = emoji.codePointAt(0)?.toString(16) ?? '';
  return `/reactions/${cp}.gif`;
}

export function getStaticUrl(emoji: string): string {
  const cp = emoji.codePointAt(0)?.toString(16) ?? '';
  return `/reactions/${cp}.svg`;
}
