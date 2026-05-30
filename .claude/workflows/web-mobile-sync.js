export const meta = {
  name: 'web-mobile-sync',
  description: 'Port 11 missing bk-web features into bk-mobile with per-feature verification',
  phases: [
    { title: 'Analyze', detail: 'Read bk-web source, produce port specs for 11 features' },
    { title: 'Implement', detail: 'Port each feature to bk-mobile (bk-web is read-only)' },
    { title: 'Verify', detail: 'Run typecheck + lint after each feature' },
    { title: 'Summary', detail: 'Write sync-results.md with outcome per feature' },
  ],
}

const REPO = '/Users/bason/Documents/bason-labs/bs-kara'

const SPEC_SCHEMA = {
  type: 'object',
  required: ['feature', 'sourceFiles', 'targetFiles', 'api', 'rnAdaptations', 'webSourceContent'],
  properties: {
    feature: { type: 'string' },
    sourceFiles: { type: 'array', items: { type: 'string' } },
    targetFiles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'action'],
        properties: {
          path: { type: 'string' },
          action: { type: 'string', enum: ['create', 'modify'] },
        },
      },
    },
    api: { type: 'string' },
    firebasePaths: { type: 'array', items: { type: 'string' } },
    sharedDeps: { type: 'array', items: { type: 'string' } },
    rnAdaptations: { type: 'array', items: { type: 'string' } },
    webSourceContent: { type: 'string' },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['passed'],
  properties: {
    passed: { type: 'boolean' },
    errors: { type: 'string' },
    warnings: { type: 'string' },
  },
}

const FEATURES = [
  {
    name: 'useSongScore',
    description: 'Hook that subscribes to Firebase RTDB emoji reactions for the current song and computes a numeric score + verdict string. Uses onChildAdded to collect reactions since the song started.',
    webFiles: [
      'bk-web/hooks/useSongScore.ts',
    ],
  },
  {
    name: 'ScoreBlock + EndScreenOverlay',
    description: 'ScoreBlock renders a post-song emoji-vote score display with emoji breakdown and a verdict message. EndScreenOverlay wraps ScoreBlock in a full-screen between-songs overlay with a fade-out transition.',
    webFiles: [
      'bk-web/components/ScoreBlock.tsx',
      'bk-web/components/EndScreenOverlay.tsx',
    ],
  },
  {
    name: 'EmojiLayer',
    description: 'Animated floating emoji overlay. Exposes an imperative ref handle with addEmoji(emoji) that spawns a new flying emoji. Each emoji animates upward with random horizontal drift and fades out. Used in the player screen.',
    webFiles: [
      'bk-web/components/EmojiLayer.tsx',
    ],
  },
  {
    name: 'useMCPlayer',
    description: 'Hook that orchestrates AI MC announcements: checks lastAnnouncedSongId lock in Firebase, fetches MC text from /api/generate-mc, speaks via /api/tts (Google Cloud TTS with expo-speech fallback), and gates video playback during speech. Writes lastAnnouncedSongId to prevent double-announcements across devices.',
    webFiles: [
      'bk-web/hooks/useMCPlayer.ts',
      'bk-web/hooks/useAIVoice.ts',
    ],
  },
  {
    name: 'MCAnnouncementOverlay',
    description: 'Full-screen overlay shown while isMcGated is true. Displays the MC announcement text with a fade-in animation. Shown in the player screen over the video.',
    webFiles: [
      'bk-web/components/MCAnnouncementOverlay.tsx',
    ],
  },
  {
    name: 'useAutoRandom',
    description: 'Hook that fires when queue is empty, hasCurrentPlaying is false, and autoRandomEnabled is true. Uses buildRandomSearchQuery + pickRandomTitle from @bs-kara/shared to pick a song, calls the /api/youtube/search BFF, and writes the result to currentPlaying via setCurrentPlayingDirectly. Internal busy ref prevents double-fires.',
    webFiles: [
      'bk-web/hooks/useAutoRandom.ts',
    ],
  },
  {
    name: 'useInactivityTimeout + SessionExpiredOverlay',
    description: 'useInactivityTimeout polls Firebase every 60 seconds and compares lastEndedAt against the current time plus a 60-minute threshold. SessionExpiredOverlay is a full-screen modal that blocks UI when the session expires, with a "Rejoin" button.',
    webFiles: [
      'bk-web/features/remote/hooks/useInactivityTimeout.ts',
      'bk-web/features/remote/components/SessionExpiredOverlay.tsx',
    ],
  },
  {
    name: 'useFullscreenOwnership',
    description: 'Firebase runTransaction lock on rooms/{roomId}/fullscreenOwner. Acquires on mount if unset or expired, releases on unmount via onDisconnect. Prevents two devices entering fullscreen simultaneously.',
    webFiles: [
      'bk-web/features/remote/hooks/useFullscreenOwnership.ts',
    ],
  },
  {
    name: 'PlayNowButton',
    description: 'Host-only icon button. On press: removes the song from its current queue position and writes it to currentPlaying, stopping whatever was playing. Rendered inside QueueItemRow — only visible when isHost is true.',
    webFiles: [
      'bk-web/features/remote/components/PlayNowButton.tsx',
    ],
  },
  {
    name: 'IdleQRCode',
    description: 'QR code shown in the player screen when currentPlaying is null and the queue is empty. Points to the room join URL (NEXT_PUBLIC_SITE_URL + /?room=<roomCode>). Uses react-native-qrcode-svg on mobile (not qrcode.react).',
    webFiles: [
      'bk-web/components/IdleQRCode.tsx',
    ],
  },
  {
    name: 'NeonOrbs',
    description: 'Decorative background component. Renders 3-5 blurred circles with neon colours (purple, cyan, pink) that slowly drift using Animated.loop + Animated.timing. No Firebase dependency. Added to the join screen (app/join.tsx) as an absolute-positioned background layer.',
    webFiles: [
      'bk-web/features/remote/components/NeonOrbs.tsx',
    ],
  },
]
