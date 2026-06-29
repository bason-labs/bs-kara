// Pull the v= id out of a YouTube watch URL. Returns null when the URL is empty
// or has no parseable id. Shared by the web (sync) and mobile (async) ad-mask
// detection so the URL-parsing rule lives in one place.
export function parseVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}
