import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

// Hoisted state so vi.mock factories (which run before the imports below) can
// reference it, and individual tests can mutate it before render.
const state = vi.hoisted(() => ({
  isMcGated: false as boolean,
  mcText: null as string | null,
  videoPlayerProps: null as Record<string, unknown> | null,
  setIsPlayingMock: vi.fn(),
  currentPlaying: {
    id: 'abc123',
    title: 'Test Song',
    channel: 'Test Channel',
    thumbnail: 'https://example.com/thumb.jpg',
    duration: '3:30',
  } as Record<string, unknown> | null,
}));

vi.mock('@/hooks/useRoom', () => ({
  useRoom: () => ({
    roomData: {
      queue: [],
      currentPlaying: state.currentPlaying,
      isPlaying: true,
      volume: 80,
      history: [],
      isAutoRandomMode: false,
      randomFilters: {},
      playedHistory: [],
      dragDropEnabled: true,
      requesterPromptEnabled: true,
      isMCEnabled: true,
      mcVoice: 'vi-VN-Neural2-A',
      lastAnnouncedSongId: null,
      isTvActive: false,
      lastEndedAt: null,
    },
    isLoading: false,
    playNext: vi.fn(),
    resetRoom: vi.fn(),
    setIsPlaying: state.setIsPlayingMock,
    addToPlayedHistory: vi.fn(),
    setCurrentPlayingDirectly: vi.fn(),
    tryClaimAnnouncementLock: vi.fn(),
  }),
}));

vi.mock('@/hooks/useMCPlayer', () => ({
  useMCPlayer: () => ({ isMcGated: state.isMcGated, mcText: state.mcText }),
}));

vi.mock('@/hooks/useAutoRandom', () => ({ useAutoRandom: () => {} }));
vi.mock('@/hooks/useAutoHide', () => ({ useAutoHide: () => true }));

vi.mock('@/lib/activeRoom', () => ({
  claimOrGetActiveRoom: vi.fn().mockResolvedValue('1234'),
}));

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  onDisconnect: () => ({
    cancel: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: () => null,
}));

vi.mock('next/image', () => ({
  default: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/VideoPlayer', () => ({
  VideoPlayer: (props: Record<string, unknown>) => {
    state.videoPlayerProps = props;
    return <div data-testid="video-player" />;
  },
}));

vi.mock('@/components/EmojiLayer', () => ({
  EmojiLayer: () => null,
}));

vi.mock('@/components/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

import TVClient from './TVClient';

describe('TVClient — MC gate / video autoplay', () => {
  beforeEach(() => {
    state.isMcGated = false;
    state.mcText = null;
    state.videoPlayerProps = null;
    state.setIsPlayingMock = vi.fn();
    state.currentPlaying = {
      id: 'abc123',
      title: 'Test Song',
      channel: 'Test Channel',
      thumbnail: 'https://example.com/thumb.jpg',
      duration: '3:30',
    };
  });

  afterEach(() => {
    cleanup();
  });

  // Regression: previously the TV unmounted VideoPlayer entirely while
  // isMcGated was true, then remounted it with autoplay=1 after the MC
  // finished speaking. By that point the user gesture from the Waiting
  // Room tap had expired, so Chrome blocked unmuted autoplay and forced
  // the user to click play. Keeping the iframe mounted across the gate
  // (paused + muted) ensures the iframe loads inside the fresh gesture
  // and a later play() call is allowed.
  it('keeps the VideoPlayer mounted while MC is announcing (paused + muted)', async () => {
    state.isMcGated = true;
    state.mcText = 'Welcome the next singer!';

    render(<TVClient />);
    // Simulate the user's first interaction so isInitialized flips true
    // and the player branch renders.
    const waiting = await screen.findByRole('button', { name: /waiting room/i });
    await act(async () => {
      waiting.click();
    });

    expect(screen.getByTestId('video-player')).toBeInTheDocument();
    expect(state.videoPlayerProps).toMatchObject({
      videoId: 'abc123',
      isPlaying: false,
      volume: 0,
    });
    // While MC is speaking we suppress the iframe→React sync to avoid
    // echoing the autoplay-then-pause ping back into shared state.
    expect(state.videoPlayerProps?.onPlayingChange).toBeUndefined();
  });

  it('plays the video unmuted when MC is not gating', async () => {
    state.isMcGated = false;

    render(<TVClient />);
    const waiting = await screen.findByRole('button', { name: /waiting room/i });
    await act(async () => {
      waiting.click();
    });

    expect(state.videoPlayerProps).toMatchObject({
      videoId: 'abc123',
      isPlaying: true,
      volume: 80,
    });
    expect(typeof state.videoPlayerProps?.onPlayingChange).toBe('function');
  });
});
