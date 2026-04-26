export const REACTIONS = ['💖', '🔥', '🎉', '👏', '🥳'] as const;

export function getGifUrl(emoji: string): string {
  const cp = emoji.codePointAt(0)?.toString(16) ?? '';
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${cp}/512.gif`;
}
