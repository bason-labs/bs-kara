/**
 * Regression tests for the Android UNMUTED-autoplay freeze fix.
 *
 * Bug: Android System WebView blocks unmuted autoplay without an
 * in-document user gesture. Before the fix, mute was wired as
 *   mute={isMcGated || isAdGated}
 * so after the MC gate dropped (isMcGated=false, isAdGated=false) the
 * player resumed UNMUTED → WebView blocked autoplay → video froze.
 *
 * Fix: added `|| !audioUnlocked` to the mute expression, where
 *   audioUnlocked = Platform.OS !== 'android'  (initial value)
 * iOS starts unlocked (true), Android starts locked (false).
 *
 * These tests capture the props passed to YoutubeIframe and assert on
 * `mute` and `play` so any future regression (reverting to the old
 * expression) will turn these red immediately.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

// ─── YoutubeIframe capture ────────────────────────────────────────────────────
// Capture every set of props the mock receives so we can assert on mute/play.
const iframeProps: Record<string, unknown>[] = [];
jest.mock('react-native-youtube-iframe', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      iframeProps.push(props);
      return React.createElement('YoutubeIframe', props);
    },
    PLAYER_STATES: { PLAYING: 'playing' },
  };
});

// ─── Hook mocks ──────────────────────────────────────────────────────────────
const mockUseMCPlayer = jest.fn();
jest.mock('@/hooks/useMCPlayer', () => ({
  useMCPlayer: (...args: unknown[]) => mockUseMCPlayer(...args),
}));

const mockUseAdMask = jest.fn();
jest.mock('@/hooks/useAdMask', () => ({
  useAdMask: (...args: unknown[]) => mockUseAdMask(...args),
}));

// ─── Context / provider mocks ─────────────────────────────────────────────────
jest.mock('@/context/RoomContext', () => ({
  useRoomContext: () => ({
    roomData: {
      currentPlaying: { id: 'vid1', title: 'Test Song', channel: 'ch', thumbnail: '', duration: '' },
      isMCEnabled: true,
      mcVoice: 'vi-VN-Neural2-A',
      queue: [],
    },
    setIsPlaying: jest.fn(),
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ preference: 'dark', resolvedTheme: 'dark', setPreference: jest.fn() }),
}));

// ─── Ambient mocks ────────────────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('expo-screen-orientation', () => ({
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
  OrientationLock: { LANDSCAPE_RIGHT: 'LANDSCAPE_RIGHT' },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('lucide-react-native', () => ({
  X: () => null,
  Sparkles: () => null,
  Coffee: () => null,
}));

// Mock child overlays to avoid deep dependency trees (lucide-react-native
// internals, react-native-css-interop) that are not under test here.
jest.mock('@/components/AdIntermissionOverlay', () => ({
  AdIntermissionOverlay: () => null,
}));

jest.mock('@/components/MCAnnouncementOverlay', () => ({
  MCAnnouncementOverlay: () => null,
}));

// ─── Subject under test ───────────────────────────────────────────────────────
import { FullscreenPlayer } from './FullscreenPlayer';

// ─── Helpers ──────────────────────────────────────────────────────────────────
beforeEach(() => {
  iframeProps.length = 0;
  // Default hook returns: no gating at all
  mockUseMCPlayer.mockReturnValue({ isMcGated: false, mcText: null });
  mockUseAdMask.mockReturnValue({ isAdGated: false });
});

afterEach(() => {
  // Reset Platform.OS to ios (neutral default) between tests so mutations
  // in one test don't leak into the next.
  (Platform as { OS: string }).OS = 'ios';
});

// ─── Tests ────────────────────────────────────────────────────────────────────

/**
 * THE REGRESSION GUARD.
 *
 * With the OLD code `mute={isMcGated || isAdGated}`:
 *   isMcGated=false, isAdGated=false → mute=false → WebView blocked autoplay
 *   → video froze (THE BUG).
 *
 * With the NEW code `mute={isMcGated || isAdGated || !audioUnlocked}`:
 *   Platform.OS='android' → audioUnlocked=false → !audioUnlocked=true
 *   → mute=true → WebView allows muted autoplay → no freeze.
 *   play=true (isMcGated=false) → playback actually starts.
 *
 * This test fails against the old expression and passes only with the fix.
 */
it('resumes muted (not frozen) on Android so autoplay is allowed after MC', () => {
  (Platform as { OS: string }).OS = 'android';

  render(<FullscreenPlayer videoId="vid1" isPlaying={true} onClose={jest.fn()} />);

  // The first set of props captured is the initial render.
  const props = iframeProps[0];
  // play must be true — the player should be running (MC is no longer gating).
  expect(props.play).toBe(true);
  // mute must be true — Android audioUnlocked starts false, so !audioUnlocked=true
  // forces mute regardless of isMcGated/isAdGated.
  // OLD code: mute = false||false = false → FREEZE BUG
  // NEW code: mute = false||false||true = true → safe muted autoplay ✓
  expect(props.mute).toBe(true);
});

/**
 * iOS starts with audioUnlocked=true (WKWebView permits unmuted autoplay),
 * so mute should be false when there is no MC or ad gate.
 * Verifies the fix does not regress iOS playback.
 */
it('is unmuted on iOS when no MC or ad gate is active', () => {
  (Platform as { OS: string }).OS = 'ios';

  render(<FullscreenPlayer videoId="vid1" isPlaying={true} onClose={jest.fn()} />);

  const props = iframeProps[0];
  // audioUnlocked=true on iOS → !audioUnlocked=false → mute = false||false||false = false
  expect(props.mute).toBe(false);
  expect(props.play).toBe(true);
});

/**
 * Ad gate still forces mute regardless of platform.
 * Uses iOS so audioUnlocked=true, isolating the isAdGated term.
 * mute = false || true || false = true.
 */
it('mutes when an ad is gated (iOS, audioUnlocked=true)', () => {
  (Platform as { OS: string }).OS = 'ios';
  mockUseAdMask.mockReturnValue({ isAdGated: true });

  render(<FullscreenPlayer videoId="vid1" isPlaying={true} onClose={jest.fn()} />);

  const props = iframeProps[0];
  expect(props.mute).toBe(true);
  // play should still be true when only the ad gate is active (not the MC gate)
  expect(props.play).toBe(true);
});
