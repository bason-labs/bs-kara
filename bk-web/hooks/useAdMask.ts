// Minimal player surface useAdMask depends on. The real react-youtube player
// exposes far more; narrowing keeps the unit-test fakes tiny.
export interface AdMaskPlayer {
  getPlayerState: () => number;
  getVideoUrl: () => string;
}

// YT.PlayerState.PLAYING === 1.
const YT_PLAYING = 1;

// Pull the v= id out of a watch URL. Returns null when the URL is empty or has
// no parseable id.
export function parseVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

// True when an ad is *likely* on screen: the player is PLAYING but the id in
// getVideoUrl() differs from the song we asked for. Fail-safe: any throw,
// non-PLAYING state, or unparseable URL returns false (never a false ad).
export function detectAd(player: AdMaskPlayer, requestedVideoId: string): boolean {
  if (!requestedVideoId) return false;
  try {
    if (player.getPlayerState() !== YT_PLAYING) return false;
    const playingId = parseVideoId(player.getVideoUrl());
    if (!playingId) return false; // SPIKE NOTE: if Task 1 found ads report an
    // EMPTY url (not a different id), change this line to `return true`
    // and update the "empty / unparseable url" test to expect true.
    return playingId !== requestedVideoId;
  } catch {
    return false;
  }
}
